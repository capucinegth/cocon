/**
 * Régression (test sur iPhone de la PR « scan + dossiers ») : le code est déployé AVANT la migration
 * « dossiers ». La base de production n'a alors ni `documents.folder_id`, ni `document_folders` ; le
 * chargement échouait (« Tes documents n'ont pas pu être chargés ») et l'enregistrement d'un document
 * aussi (folder_id envoyé). Les documents doivent fonctionner comme avant, simplement sans dossiers.
 *
 * Le faux PostgREST ci-dessous répond avec les MÊMES codes que la vraie pile (PGRST205, 42703, PGRST204).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { uuid } from "@/lib/ids";
import type { DocumentDraft } from "@/services/documents/repository";
import { createSupabaseDocumentRepository } from "@/services/documents/supabase-repository";
import { RepositoryError } from "@/services/repository";

const USER = "11111111-1111-1111-1111-111111111111";

interface Call {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  values?: Record<string, unknown>;
}

function fakePostgrest({ migrated, deniedTable }: { migrated: boolean; deniedTable?: string }) {
  const calls: Call[] = [];
  const rows: Record<string, Record<string, unknown>[]> = { documents: [], document_fields: [], document_deadlines: [], document_folders: [] };
  const documentRow = (values: Record<string, unknown>) => ({
    created_at: "2026-10-18T08:00:00Z",
    description: "",
    page_count: null,
    document_date: null,
    period_year: null,
    period_month: null,
    ...values,
  });

  function from(table: string) {
    const call: Call = { table, action: "select" };
    calls.push(call);
    let single = false;
    const query = {
      select(columns?: string) {
        call.columns = columns;
        return query;
      },
      insert(values: Record<string, unknown>) {
        Object.assign(call, { action: "insert", values });
        return query;
      },
      update(values: Record<string, unknown>) {
        Object.assign(call, { action: "update", values });
        return query;
      },
      upsert(values: Record<string, unknown>) {
        Object.assign(call, { action: "upsert", values });
        return query;
      },
      delete() {
        call.action = "delete";
        return query;
      },
      eq: () => query,
      order: () => query,
      limit: () => query,
      single() {
        single = true;
        return query;
      },
      then(resolve: (result: unknown) => void) {
        if (table === deniedTable) return resolve({ data: null, error: { code: "42501", message: "permission denied" }, status: 403 });
        // Base pas encore migrée : mêmes réponses que PostgREST.
        if (!migrated && table === "document_folders") {
          return resolve({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.document_folders' in the schema cache" }, status: 404 });
        }
        if (!migrated && table === "documents" && call.columns?.includes("folder_id")) {
          return resolve({ data: null, error: { code: "42703", message: "column documents.folder_id does not exist" }, status: 400 });
        }
        if (!migrated && table === "documents" && call.values && "folder_id" in call.values) {
          return resolve({ data: null, error: { code: "PGRST204", message: "Could not find the 'folder_id' column of 'documents' in the schema cache" }, status: 400 });
        }
        if (call.action === "insert" && table === "documents") {
          const row = documentRow(call.values!);
          rows.documents.push(row);
          return resolve({ data: single ? row : [row], error: null, status: 201 });
        }
        if (call.action === "update" || call.action === "delete") return resolve({ data: [{ id: "x" }], error: null, status: 200 });
        if (call.action === "upsert") return resolve({ data: { ...call.values, created_at: "2026-10-18T08:00:00Z" }, error: null, status: 201 });
        return resolve({ data: rows[table] ?? [], error: null, status: 200 });
      },
    };
    return query;
  }

  const storage = {
    from: () => ({
      upload: () => Promise.resolve({ data: { path: "ok" }, error: null }),
      remove: () => Promise.resolve({ data: [], error: null }),
    }),
  };
  const auth = { getUser: () => Promise.resolve({ data: { user: { id: USER } }, error: null }) };
  rows.documents.push(documentRow({ id: "existant", category: "impots", document_type: "avis_imposition", title: "Avis d'imposition · 2026", file_path: `${USER}/existant/avis.pdf`, file_name: "avis.pdf", mime_type: "application/pdf", file_size_bytes: 1000, classification_status: "confirme", classification_source: "nom_fichier", ...(migrated ? { folder_id: null } : {}) }));
  return { client: { from, storage, auth } as unknown as SupabaseClient, calls };
}

const draft = (): DocumentDraft => ({
  id: uuid(),
  category: "assurances",
  type: "assurance_auto",
  title: "Carte grise",
  description: "",
  fileName: "carte-grise.pdf",
  mimeType: "application/pdf",
  fileSize: 1000,
  pageCount: 1,
  classificationStatus: "confirme",
  classificationSource: "utilisateur",
});

describe("base de production pas encore migrée (dossiers)", () => {
  it("les documents se chargent, sans dossiers (au lieu de « Tes documents n'ont pas pu être chargés »)", async () => {
    const { client } = fakePostgrest({ migrated: false });
    const state = await createSupabaseDocumentRepository(client).load("2026-10-18");
    expect(state.foldersEnabled).toBe(false);
    expect(state.folders).toEqual([]);
    expect(state.documents.map((d) => d.title)).toEqual(["Avis d'imposition · 2026"]);
    expect(state.documents[0].folderId).toBeUndefined();
  });

  it("un document s'enregistre : folder_id n'est ni envoyé ni relu", async () => {
    const { client, calls } = fakePostgrest({ migrated: false });
    const repo = createSupabaseDocumentRepository(client);
    await repo.load("2026-10-18");
    const doc = await repo.createDocument(draft(), new Blob(["%PDF-1.4"]), []);
    expect(doc.title).toBe("Carte grise");
    const insert = calls.find((c) => c.table === "documents" && c.action === "insert")!;
    expect(insert.values).not.toHaveProperty("folder_id");
    expect(insert.columns).not.toContain("folder_id");
  });

  it("même sans chargement préalable, l'enregistrement s'adapte à la base (une seule nouvelle tentative)", async () => {
    const { client, calls } = fakePostgrest({ migrated: false });
    const repo = createSupabaseDocumentRepository(client);
    const doc = await repo.createDocument(draft(), new Blob(["%PDF-1.4"]), []);
    expect(doc.title).toBe("Carte grise");
    const inserts = calls.filter((c) => c.table === "documents" && c.action === "insert");
    expect(inserts).toHaveLength(2);
    expect(inserts[1].values).not.toHaveProperty("folder_id");
    // Ensuite, plus aucune tentative avec folder_id.
    await repo.createDocument(draft(), new Blob(["%PDF-1.4"]), []);
    expect(calls.filter((c) => c.table === "documents" && c.action === "insert")).toHaveLength(3);
    await expect(repo.saveFolder({ id: uuid(), name: "Voiture", emoji: "📁", createdAt: "" })).rejects.toThrow(/pas encore disponibles/);
  });

  it("modifier une fiche n'envoie pas folder_id ; créer un dossier est refusé clairement", async () => {
    const { client, calls } = fakePostgrest({ migrated: false });
    const repo = createSupabaseDocumentRepository(client);
    const state = await repo.load("2026-10-18");
    await repo.updateDocument({ ...state.documents[0], title: "Avis 2026", folderId: "un-dossier" });
    expect(calls.find((c) => c.action === "update")!.values).not.toHaveProperty("folder_id");
    await expect(repo.saveFolder({ id: uuid(), name: "Voiture", emoji: "📁", createdAt: "" })).rejects.toThrow(/pas encore disponibles/);
    await expect(repo.deleteFolder("x")).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe("base migrée (dossiers)", () => {
  it("dossiers disponibles, folder_id lu et envoyé", async () => {
    const { client, calls } = fakePostgrest({ migrated: true });
    const repo = createSupabaseDocumentRepository(client);
    const state = await repo.load("2026-10-18");
    expect(state.foldersEnabled).toBe(true);
    await repo.createDocument({ ...draft(), folderId: "dossier-1" }, new Blob(["%PDF-1.4"]), []);
    const insert = calls.find((c) => c.table === "documents" && c.action === "insert")!;
    expect(insert.values).toMatchObject({ folder_id: "dossier-1" });
    expect(insert.columns).toContain("folder_id");
  });

  it("une autre erreur de la base n'est pas confondue avec une base non migrée", async () => {
    for (const migrated of [true, false]) {
      const { client } = fakePostgrest({ migrated, deniedTable: "document_fields" });
      await expect(createSupabaseDocumentRepository(client).load("2026-10-18")).rejects.toBeInstanceOf(RepositoryError);
    }
    const { client: failing } = fakePostgrest({ migrated: true, deniedTable: "document_folders" });
    await expect(createSupabaseDocumentRepository(failing).load("2026-10-18")).rejects.toBeInstanceOf(RepositoryError);
  });
});
