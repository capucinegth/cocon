import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { storageFileName } from "@/lib/admin/files";
import { RepositoryError } from "@/services/repository";
import { toRepositoryError } from "@/services/supabase-repository";
import type { AdminDocument } from "@/types/documents";
import {
  DEADLINE_COLUMNS,
  DOCUMENT_BASE_COLUMNS,
  DOCUMENT_COLUMNS,
  FIELD_COLUMNS,
  FOLDER_COLUMNS,
  deadlineFromRow,
  deadlineToRow,
  documentFromRow,
  documentToRow,
  fieldFromRow,
  fieldToRow,
  folderFromRow,
  folderToRow,
  newDocumentToRow,
  type DeadlineRow,
  type DocumentRow,
  type FieldRow,
  type FolderRow,
} from "./mappers";
import { SIGNED_URL_SECONDS, type DocumentRepository } from "./repository";

/** Espace de stockage PRIVÉ des documents (voir la migration « administratif_stockage »). */
export const DOCUMENTS_BUCKET = "documents";

type Result<T> = { data: T | null; error: PostgrestError | null; status?: number };

/**
 * Table ou colonne inconnue (PostgreSQL 42P01 / 42703, cache de schéma PostgREST PGRST205 / PGRST204) :
 * la base n'a pas encore la migration « dossiers ».
 */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);
const MISSING = Symbol("schéma absent");

/** Comme `must`, mais renvoie MISSING si la table ou la colonne demandée n'existe pas (encore). */
async function unlessMissing<T>(query: PromiseLike<Result<T>>, action: string): Promise<T | typeof MISSING> {
  let result: Result<T>;
  try {
    result = await query;
  } catch (error) {
    throw toRepositoryError({ message: error instanceof Error ? error.message : String(error), code: "", status: 0 }, action);
  }
  if (result.error && MISSING_SCHEMA_CODES.has(result.error.code)) return MISSING;
  if (result.error) throw toRepositoryError({ ...result.error, status: result.status }, action);
  return result.data as T;
}

/** Sans la migration « dossiers », la colonne folder_id n'est jamais envoyée. */
function withoutFolder<T extends { folder_id?: unknown }>(row: T): Omit<T, "folder_id"> {
  const { folder_id: _ignored, ...rest } = row;
  void _ignored;
  return rest;
}

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
  /**
   * Base à jour (migration « dossiers » appliquée) ? Connu au chargement ; supposé vrai avant.
   * Sans elle, tout le reste fonctionne : les dossiers sont simplement indisponibles.
   */
  let foldersReady = true;
  /** Écrit avec folder_id si la base le connaît ; sinon (base pas encore migrée), recommence sans, une fois. */
  async function writeDocument<T>(run: (withFolder: boolean) => PromiseLike<Result<T>>, action: string): Promise<T> {
    if (foldersReady) {
      const result = await unlessMissing(run(true), action);
      if (result !== MISSING) return result;
      foldersReady = false;
    }
    return must(run(false), action);
  }
  const foldersUnavailable = () => new RepositoryError("Les dossiers ne sont pas encore disponibles : la base de données doit d'abord être mise à jour.", "server");

  async function currentUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new RepositoryError("Ta session a expiré. Reconnecte-toi pour continuer.", "auth", error?.message);
    return data.user.id;
  }

  return {
    source: "supabase",

    async load(today) {
      const selectDocuments = (columns: string) => client.from("documents").select(columns).order("created_at", { ascending: false }).limit(2000);
      const [withFolders, fields, deadlines, folders] = await Promise.all([
        unlessMissing<DocumentRow[]>(selectDocuments(DOCUMENT_COLUMNS) as unknown as PromiseLike<Result<DocumentRow[]>>, "charger tes documents"),
        must<FieldRow[]>(client.from("document_fields").select(FIELD_COLUMNS).limit(10000), "charger tes documents"),
        must<DeadlineRow[]>(client.from("document_deadlines").select(DEADLINE_COLUMNS).order("due_date").limit(5000), "charger tes échéances"),
        unlessMissing<FolderRow[]>(client.from("document_folders").select(FOLDER_COLUMNS).order("name").limit(500), "charger tes dossiers"),
      ]);
      foldersReady = withFolders !== MISSING && folders !== MISSING;
      // Base pas encore migrée : les documents se chargent comme avant, sans dossiers.
      const documents =
        withFolders !== MISSING
          ? withFolders
          : await must<DocumentRow[]>(selectDocuments(DOCUMENT_BASE_COLUMNS) as unknown as PromiseLike<Result<DocumentRow[]>>, "charger tes documents");
      return {
        today,
        documents: documents.map(documentFromRow),
        fields: fields.map(fieldFromRow),
        deadlines: deadlines.map(deadlineFromRow),
        folders: foldersReady && folders !== MISSING ? folders.map(folderFromRow) : [],
        foldersEnabled: foldersReady,
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
        const saved = await writeDocument<DocumentRow>(
          (withFolder) =>
            client
              .from("documents")
              .insert(withFolder ? newDocumentToRow(document) : withoutFolder(newDocumentToRow(document)))
              .select(withFolder ? DOCUMENT_COLUMNS : DOCUMENT_BASE_COLUMNS)
              .single() as unknown as PromiseLike<Result<DocumentRow>>,
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
      const rows = await writeDocument<unknown[]>(
        (withFolder) =>
          client
            .from("documents")
            .update(withFolder ? documentToRow(document) : withoutFolder(documentToRow(document)))
            .eq("id", document.id)
            .select("id"),
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

    async saveFolder(folder) {
      if (!foldersReady) throw foldersUnavailable();
      const saved = await must<FolderRow>(
        client.from("document_folders").upsert(folderToRow(folder)).select(FOLDER_COLUMNS).single(),
        "enregistrer le dossier",
      );
      return folderFromRow(saved);
    },

    async deleteFolder(folderId) {
      if (!foldersReady) throw foldersUnavailable();
      // Les documents du dossier restent : la base vide seulement leur folder_id (on delete set null).
      const rows = await must<unknown[]>(client.from("document_folders").delete().eq("id", folderId).select("id"), "supprimer le dossier");
      if (!rows || rows.length === 0) throw new RepositoryError("Ce dossier n'existe plus.", "conflict");
    },
  };
}
