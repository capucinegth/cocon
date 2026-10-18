/** Dossiers personnels de « Mes papiers » : nom, tri, contenu, recherche, lignes Supabase. */
import { describe, expect, it } from "vitest";
import { documentsInFolder, folderNameProblem, searchDocuments, sortFolders } from "@/lib/admin/documents";
import { documentFromRow, documentToRow, folderFromRow, folderToRow, newDocumentToRow, type DocumentRow } from "@/services/documents/mappers";
import { createDemoDocumentRepository } from "@/services/documents/demo-repository";
import type { AdminDocument, DocumentFolder } from "@/types/documents";

const folder = (id: string, name: string): DocumentFolder => ({ id, name, emoji: "📁", createdAt: "2026-10-01T08:00:00Z" });
const doc = (id: string, title: string, folderId?: string): AdminDocument => ({
  id,
  category: "assurances",
  type: "assurance_habitation",
  title,
  description: "",
  filePath: `u/${id}/f.pdf`,
  fileName: "f.pdf",
  mimeType: "application/pdf",
  fileSize: 10,
  classificationStatus: "confirme",
  classificationSource: "utilisateur",
  folderId,
  createdAt: `2026-10-0${id.length}T08:00:00Z`,
});

const folders = [folder("f-appart", "Appartement"), folder("f-auto", "Voiture"), folder("f-ecole", "école de Léa")];

describe("dossiers : nom", () => {
  it("vide, trop long ou déjà pris : refusé avec un message clair", () => {
    expect(folderNameProblem("   ", folders)).toBe("Donne un nom à ce dossier.");
    expect(folderNameProblem("x".repeat(61), folders)).toBe("60 caractères au plus.");
    expect(folderNameProblem("  appartement ", folders)).toBe("Un dossier porte déjà ce nom.");
    expect(folderNameProblem("ÉCOLE DE LÉA", folders)).toBe("Un dossier porte déjà ce nom.");
  });

  it("le dossier renommé garde son propre nom ; un nom libre est accepté", () => {
    expect(folderNameProblem("Appartement", folders, "f-appart")).toBeNull();
    expect(folderNameProblem("Maison de vacances", folders)).toBeNull();
    expect(folderNameProblem("x".repeat(60), folders)).toBeNull();
  });

  it("tri alphabétique sans tenir compte des accents ni des majuscules", () => {
    expect(sortFolders(folders).map((f) => f.name)).toEqual(["Appartement", "école de Léa", "Voiture"]);
  });
});

describe("dossiers : contenu et recherche", () => {
  const documents = [doc("a", "Bail", "f-appart"), doc("bb", "Quittance de loyer", "f-appart"), doc("ccc", "Carte grise", "f-auto"), doc("dddd", "Facture")];
  const state = { documents, fields: [], folders };

  it("documents d'un dossier, les plus récents d'abord", () => {
    expect(documentsInFolder(state, "f-appart").map((d) => d.id)).toEqual(["bb", "a"]);
    expect(documentsInFolder(state, "f-ecole")).toEqual([]);
  });

  it("la recherche trouve aussi par nom de dossier", () => {
    const withSchool = { ...state, documents: [...documents, doc("eeeee", "Inscription", "f-ecole")] };
    expect(searchDocuments(withSchool, "ecole lea").map((d) => d.id)).toEqual(["eeeee"]);
    // Sans dossiers fournis, rien ne change.
    expect(searchDocuments({ documents: withSchool.documents, fields: [] }, "ecole lea")).toEqual([]);
  });
});

describe("dossiers : lignes Supabase", () => {
  it("folder_id ⇄ folderId (vide → null / undefined), jamais user_id", () => {
    const row = { ...newDocumentToRow(doc("a", "Bail", "f-appart")) } as Record<string, unknown>;
    expect(row.folder_id).toBe("f-appart");
    expect(row).not.toHaveProperty("user_id");
    expect(documentToRow(doc("a", "Bail")).folder_id).toBeNull();
    const back = documentFromRow({ ...(row as unknown as DocumentRow), folder_id: null, created_at: "2026-10-01T08:00:00Z" });
    expect(back.folderId).toBeUndefined();
  });

  it("dossier : nom nettoyé, sans user_id", () => {
    const row = folderToRow({ ...folder("f1", "  Appartement  "), emoji: "🏠" });
    expect(row).toEqual({ id: "f1", name: "Appartement", emoji: "🏠" });
    expect(folderFromRow({ id: "f1", name: "Appartement", emoji: "🏠", created_at: "2026-10-01T08:00:00Z" })).toEqual({
      id: "f1",
      name: "Appartement",
      emoji: "🏠",
      createdAt: "2026-10-01T08:00:00Z",
    });
  });

  it("démo : un dossier fictif, un document rangé dedans", async () => {
    const state = await createDemoDocumentRepository("2026-09-13").load("2026-09-13");
    expect(state.folders.map((f) => f.name)).toEqual(["Appartement"]);
    expect(documentsInFolder(state, state.folders[0].id).map((d) => d.title)).toEqual(["Assurance habitation"]);
  });
});
