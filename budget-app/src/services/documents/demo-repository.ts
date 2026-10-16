/**
 * Mode démo : documents fictifs en mémoire, rien n'est envoyé ni enregistré nulle part.
 * Les fichiers sont gardés le temps de la visite ; les liens sont locaux (blob:) et révoqués après 60 s.
 */
import { buildTextPdf } from "@/lib/admin/files";
import { RepositoryError } from "@/services/repository";
import type { AdminDocument, AdminState, DocumentDeadline, DocumentField, DocumentFolder } from "@/types/documents";
import { SIGNED_URL_SECONDS, type DocumentRepository } from "./repository";

const DEMO_USER = "demo";

function pdf(lines: string[]): Blob {
  return new Blob([buildTextPdf([...lines, "", "Document fictif de démonstration : aucune donnée réelle."]) as BlobPart], { type: "application/pdf" });
}

function demoDocument(partial: Partial<AdminDocument> & Pick<AdminDocument, "id" | "category" | "type" | "title" | "fileName">): AdminDocument {
  return {
    description: "",
    filePath: `${DEMO_USER}/${partial.id}/${partial.fileName}`,
    mimeType: "application/pdf",
    fileSize: 2048,
    pageCount: 1,
    classificationStatus: "confirme",
    classificationSource: "utilisateur",
    createdAt: "2026-09-01T09:00:00.000Z",
    ...partial,
  };
}

const validated = { status: "valide" as const, source: "utilisateur" as const, validatedAt: "2026-09-02T09:00:00.000Z" };

/** Données fictives, cohérentes avec la date de la démo (13 septembre 2026). */
export function createDemoAdminState(today: string): { state: AdminState; files: Map<string, Blob> } {
  const documents: AdminDocument[] = [
    demoDocument({ id: "doc-paie-08", category: "professionnel", type: "fiche_paie", title: "Fiche de paie · août 2026", fileName: "bulletin_salaire_aout_2026.pdf", periodYear: 2026, periodMonth: 8, documentDate: "2026-08-31", createdAt: "2026-09-02T08:00:00.000Z" }),
    demoDocument({ id: "doc-contrat", category: "professionnel", type: "contrat_travail", title: "Contrat de travail (CDI)", fileName: "contrat_travail_cdi.pdf", documentDate: "2024-02-15", createdAt: "2026-06-10T08:00:00.000Z" }),
    demoDocument({ id: "doc-mutuelle", category: "sante", type: "mutuelle", title: "Attestation de mutuelle", fileName: "attestation_mutuelle_2026.pdf", documentDate: "2026-01-05", createdAt: "2026-05-12T08:00:00.000Z" }),
    demoDocument({ id: "doc-remb", category: "sante", type: "remboursement", title: "Remboursement · juillet 2026", fileName: "decompte_juillet_2026.pdf", documentDate: "2026-07-28", classificationStatus: "a_verifier", classificationSource: "nom_fichier", createdAt: "2026-09-10T08:00:00.000Z" }),
    demoDocument({ id: "doc-impot", category: "impots", type: "avis_imposition", title: "Avis d'imposition · 2026", fileName: "avis_impot_2026.pdf", periodYear: 2026, documentDate: "2026-08-04", createdAt: "2026-08-05T08:00:00.000Z" }),
    demoDocument({ id: "doc-habitation", category: "assurances", type: "assurance_habitation", title: "Assurance habitation", fileName: "assurance_habitation.pdf", documentDate: "2025-10-01", folderId: "dossier-appartement", createdAt: "2026-04-02T08:00:00.000Z" }),
    demoDocument({ id: "doc-auto", category: "assurances", type: "assurance_auto", title: "Assurance automobile", fileName: "assurance_voiture.pdf", classificationStatus: "a_verifier", classificationSource: "nom_fichier", createdAt: "2026-09-12T08:00:00.000Z" }),
  ];
  const fields: DocumentField[] = [
    { id: "f-paie-employeur", documentId: "doc-paie-08", key: "employeur", text: "Atelier Lumière", ...validated },
    { id: "f-paie-mois", documentId: "doc-paie-08", key: "mois", date: "2026-08-01", ...validated },
    { id: "f-paie-net", documentId: "doc-paie-08", key: "salaire_net", amount: 2150, ...validated },
    { id: "f-paie-brut", documentId: "doc-paie-08", key: "salaire_brut", amount: 2760, status: "propose", source: "utilisateur" },
    { id: "f-impot-annee", documentId: "doc-impot", key: "annee", date: "2026-01-01", ...validated },
    { id: "f-impot-montant", documentId: "doc-impot", key: "montant", amount: 1240, ...validated },
    { id: "f-impot-limite", documentId: "doc-impot", key: "date_limite", date: "2026-09-15", ...validated },
    { id: "f-hab-assureur", documentId: "doc-habitation", key: "assureur", text: "Cocon Assurances", ...validated },
    { id: "f-hab-echeance", documentId: "doc-habitation", key: "date_echeance", date: "2026-10-01", ...validated },
  ];
  const deadlines: DocumentDeadline[] = [
    { id: "dl-impot", documentId: "doc-impot", label: "Paiement du solde d'impôt", dueDate: "2026-09-15", kind: "date_limite" },
    { id: "dl-habitation", documentId: "doc-habitation", label: "Échéance assurance habitation", dueDate: "2026-10-01", kind: "echeance" },
    { id: "dl-mutuelle", documentId: "doc-mutuelle", label: "Renouvellement mutuelle", dueDate: "2027-01-01", kind: "renouvellement" },
  ];
  const folders: DocumentFolder[] = [{ id: "dossier-appartement", name: "Appartement", emoji: "🏠", createdAt: "2026-04-02T08:00:00.000Z" }];
  const files = new Map<string, Blob>(
    documents.map((doc) => [doc.filePath, pdf([doc.title, doc.fileName])]),
  );
  return { state: { today, documents, fields, deadlines, folders }, files };
}

export function createDemoDocumentRepository(today: string): DocumentRepository {
  const { state, files } = createDemoAdminState(today);
  const done = () => Promise.resolve();

  return {
    source: "demo",
    load: () => Promise.resolve(structuredClone(state)),

    async createDocument(draft, file) {
      const document: AdminDocument = { ...draft, filePath: `${DEMO_USER}/${draft.id}/${draft.fileName}`, createdAt: new Date().toISOString() };
      files.set(document.filePath, file);
      return document;
    },
    updateDocument: done,
    async deleteDocument(document) {
      files.delete(document.filePath);
    },
    async fileUrl(document) {
      const file = files.get(document.filePath);
      if (!file) throw new RepositoryError("Ce fichier n'est plus disponible.", "conflict");
      const url = URL.createObjectURL(file);
      window.setTimeout(() => URL.revokeObjectURL(url), SIGNED_URL_SECONDS * 1000);
      return url;
    },
    saveField: done,
    deleteField: done,
    saveDeadline: done,
    deleteDeadline: done,
    saveFolder: (folder) => Promise.resolve({ ...folder, name: folder.name.trim() }),
    deleteFolder: done,
  };
}
