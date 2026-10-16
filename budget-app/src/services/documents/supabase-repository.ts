import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { storageFileName } from "@/lib/admin/files";
import { RepositoryError } from "@/services/repository";
import { toRepositoryError } from "@/services/supabase-repository";
import type { AdminDocument } from "@/types/documents";
import {
  DEADLINE_COLUMNS,
  DOCUMENT_COLUMNS,
  FIELD_COLUMNS,
  deadlineFromRow,
  deadlineToRow,
  documentFromRow,
  documentToRow,
  fieldFromRow,
  fieldToRow,
  newDocumentToRow,
  type DeadlineRow,
  type DocumentRow,
  type FieldRow,
} from "./mappers";
import { SIGNED_URL_SECONDS, type DocumentRepository } from "./repository";

/** Espace de stockage PRIVÉ des documents (voir la migration « administratif_stockage »). */
export const DOCUMENTS_BUCKET = "documents";

type Result<T> = { data: T | null; error: PostgrestError | null; status?: number };

async function must<T>(query: PromiseLike<Result<T>>, action: string): Promise<T> {
  let result: Result<T>;
  try {
    result = await query;
  } catch (error) {
    throw toRepositoryError({ message: error instanceof Error ? error.message : String(error), code: "", status: 0 }, action);
  }
  if (result.error) throw toRepositoryError({ ...result.error, status: result.status }, action);
  return result.data as T;
}

/** Erreur du stockage → message clair (session, réseau, taille, format, accès). */
function storageError(error: { message?: string; statusCode?: string | number; status?: number }, action: string): RepositoryError {
  const message = error.message ?? "";
  const status = Number(error.statusCode ?? error.status ?? 0);
  if (status === 413 || /exceeded the maximum allowed size|payload too large/i.test(message)) {
    return new RepositoryError("Ce fichier dépasse 20 Mo : il n'a pas été enregistré.", "validation", message);
  }
  if (status === 415 || /mime type .* is not supported|invalid_mime_type/i.test(message)) {
    return new RepositoryError("Format non pris en charge : le fichier n'a pas été enregistré.", "validation", message);
  }
  return toRepositoryError({ message, code: "", status: status === 400 || status === 403 ? 403 : status }, action);
}

export function createSupabaseDocumentRepository(client: SupabaseClient): DocumentRepository {
  const bucket = () => client.storage.from(DOCUMENTS_BUCKET);

  async function currentUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new RepositoryError("Ta session a expiré. Reconnecte-toi pour continuer.", "auth", error?.message);
    return data.user.id;
  }

  return {
    source: "supabase",

    async load(today) {
      const [documents, fields, deadlines] = await Promise.all([
        must<DocumentRow[]>(client.from("documents").select(DOCUMENT_COLUMNS).order("created_at", { ascending: false }).limit(2000), "charger tes documents"),
        must<FieldRow[]>(client.from("document_fields").select(FIELD_COLUMNS).limit(10000), "charger tes documents"),
        must<DeadlineRow[]>(client.from("document_deadlines").select(DEADLINE_COLUMNS).order("due_date").limit(5000), "charger tes échéances"),
      ]);
      return {
        today,
        documents: documents.map(documentFromRow),
        fields: fields.map(fieldFromRow),
        deadlines: deadlines.map(deadlineFromRow),
      };
    },

    async createDocument(draft, file, fields) {
      const userId = await currentUserId();
      const extension = draft.mimeType === "application/pdf" ? "pdf" : draft.mimeType.split("/")[1];
      const filePath = `${userId}/${draft.id}/${storageFileName(draft.fileName, extension)}`;
      const document: AdminDocument = { ...draft, filePath, createdAt: new Date().toISOString() };

      const upload = await bucket()
        .upload(filePath, file, { contentType: draft.mimeType, upsert: false, cacheControl: "0" })
        .catch((error: Error) => ({ data: null, error }));
      if (upload.error) throw storageError(upload.error, "envoyer le document");

      try {
        const saved = await must<DocumentRow>(
          client.from("documents").insert(newDocumentToRow(document)).select(DOCUMENT_COLUMNS).single(),
          "enregistrer le document",
        );
        if (fields.length > 0) {
          // Les informations proposées sont toujours rattachées au document qui vient d'être créé.
          await must(client.from("document_fields").insert(fields.map((f) => fieldToRow({ ...f, documentId: document.id }))), "enregistrer le document");
        }
        return documentFromRow(saved);
      } catch (error) {
        // Pas de fichier orphelin : la fiche n'a pas pu être créée, on retire le fichier envoyé.
        await client.from("documents").delete().eq("id", document.id);
        await bucket().remove([filePath]);
        throw error;
      }
    },

    async updateDocument(document) {
      const rows = await must<unknown[]>(
        client.from("documents").update(documentToRow(document)).eq("id", document.id).select("id"),
        "modifier le document",
      );
      if (!rows || rows.length === 0) throw new RepositoryError("Ce document n'existe plus.", "conflict");
    },

    async deleteDocument(document) {
      // 1. Le fichier d'abord : s'il ne peut pas être supprimé, la fiche reste et rien n'est annoncé.
      const removed = await bucket()
        .remove([document.filePath])
        .catch((error: Error) => ({ data: null, error }));
      if (removed.error) throw storageError(removed.error, "supprimer le fichier");
      // 2. Puis la fiche (ses informations et échéances suivent, en cascade).
      const rows = await must<unknown[]>(client.from("documents").delete().eq("id", document.id).select("id"), "supprimer le document");
      if (!rows || rows.length === 0) throw new RepositoryError("Ce document n'existe plus.", "conflict");
    },

    async fileUrl(document, mode) {
      const { data, error } = await bucket()
        .createSignedUrl(document.filePath, SIGNED_URL_SECONDS, mode === "download" ? { download: document.fileName } : undefined)
        .catch((cause: Error) => ({ data: null, error: cause }));
      if (error || !data?.signedUrl) throw storageError(error ?? { message: "lien indisponible" }, mode === "download" ? "télécharger le document" : "ouvrir le document");
      return data.signedUrl;
    },

    async saveField(field) {
      await must(client.from("document_fields").upsert(fieldToRow(field), { onConflict: "document_id,field_key" }), "enregistrer l'information");
    },

    async deleteField(field) {
      await must(client.from("document_fields").delete().eq("id", field.id), "supprimer l'information");
    },

    async saveDeadline(deadline) {
      await must(client.from("document_deadlines").upsert(deadlineToRow(deadline)), "enregistrer l'échéance");
    },

    async deleteDeadline(deadlineId) {
      await must(client.from("document_deadlines").delete().eq("id", deadlineId), "supprimer l'échéance");
    },
  };
}
