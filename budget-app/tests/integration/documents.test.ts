/**
 * Module Administratif contre une vraie pile Supabase LOCALE (Auth + PostgREST + Storage) :
 * espace de stockage privé, liens temporaires, isolation A / B, suppression, fichiers refusés.
 */
import { describe, expect, it } from "vitest";
import { buildTextPdf } from "@/lib/admin/files";
import { uuid } from "@/lib/ids";
import { todayInParis } from "@/lib/paris-time";
import type { DocumentDraft } from "@/services/documents/repository";
import { DOCUMENTS_BUCKET, createSupabaseDocumentRepository } from "@/services/documents/supabase-repository";
import { RepositoryError } from "@/services/repository";
import type { AdminDocument } from "@/types/documents";
import { anonymousClient, localAnonKey, localUrl, signedInClient } from "./local-supabase";

const suite = localUrl && localAnonKey ? describe : describe.skip;
const today = todayInParis();

const pdfBlob = (text: string) => new Blob([buildTextPdf([text]) as BlobPart], { type: "application/pdf" });
const draft = (partial: Partial<DocumentDraft> = {}): DocumentDraft => ({
  id: uuid(),
  category: "professionnel",
  type: "fiche_paie",
  title: "Fiche de paie · septembre 2026",
  description: "",
  fileName: "bulletin_salaire_septembre_2026.pdf",
  mimeType: "application/pdf",
  fileSize: 1000,
  periodYear: 2026,
  periodMonth: 9,
  classificationStatus: "confirme",
  classificationSource: "nom_fichier",
  ...partial,
});

async function setup() {
  const alice = await signedInClient("doc-alice");
  const bob = await signedInClient("doc-bob");
  return { alice, bob, repoA: createSupabaseDocumentRepository(alice.client), repoB: createSupabaseDocumentRepository(bob.client) };
}

async function importFor(repo: ReturnType<typeof createSupabaseDocumentRepository>, text = "Fiche de paie d'Alice"): Promise<AdminDocument> {
  const file = pdfBlob(text);
  return repo.createDocument(draft({ fileSize: file.size }), file, [
    { id: uuid(), documentId: "", key: "mois", date: "2026-09-01", status: "propose", source: "nom_fichier" },
  ]);
}

suite("module Administratif (pile Supabase locale)", () => {
  it("A importe, voit, consulte et télécharge son document via des liens temporaires", async () => {
    const { alice, repoA } = await setup();
    const doc = await importFor(repoA);
    expect(doc.filePath.startsWith(`${alice.userId}/${doc.id}/`)).toBe(true);
    expect(doc.filePath.endsWith(".pdf")).toBe(true);

    const state = await repoA.load(today);
    expect(state.documents.map((d) => d.id)).toEqual([doc.id]);
    expect(state.fields).toMatchObject([{ documentId: doc.id, key: "mois", status: "propose", date: "2026-09-01" }]);

    const view = await repoA.fileUrl(doc, "view");
    expect(view).toContain("token=");
    const response = await fetch(view);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString("latin1").startsWith("%PDF-")).toBe(true);

    const download = await fetch(await repoA.fileUrl(doc, "download"));
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition") ?? "").toContain("attachment");
  });

  it("B ne voit pas le document de A, ne peut ni lire, ni lister, ni supprimer son fichier", async () => {
    const { alice, bob, repoA, repoB } = await setup();
    const doc = await importFor(repoA, "Secret d'Alice");

    expect((await repoB.load(today)).documents).toEqual([]);
    const storageB = bob.client.storage.from(DOCUMENTS_BUCKET);
    expect((await storageB.download(doc.filePath)).error).not.toBeNull();
    expect((await storageB.createSignedUrl(doc.filePath, 60)).error).not.toBeNull();
    expect((await storageB.list(alice.userId)).data ?? []).toEqual([]);
    const removed = await storageB.remove([doc.filePath]);
    expect(removed.data ?? []).toEqual([]);
    // Supprimer via le dépôt échoue sans rien prétendre, et le fichier de A est intact.
    await expect(repoB.deleteDocument(doc)).rejects.toBeInstanceOf(RepositoryError);
    await expect(repoB.updateDocument({ ...doc, title: "Piraté" })).rejects.toBeInstanceOf(RepositoryError);
    const stillThere = await alice.client.storage.from(DOCUMENTS_BUCKET).download(doc.filePath);
    expect(stillThere.error).toBeNull();
    expect((await repoA.load(today)).documents[0].title).toBe("Fiche de paie · septembre 2026");

    // B ne peut pas non plus déposer un fichier dans le dossier de A.
    const intrusion = await storageB.upload(`${alice.userId}/${uuid()}/intrus.pdf`, pdfBlob("intrus"), { contentType: "application/pdf" });
    expect(intrusion.error).not.toBeNull();
  });

  it("un visiteur non connecté n'accède à rien (espace privé, aucune URL publique)", async () => {
    const { repoA } = await setup();
    const doc = await importFor(repoA);
    const anon = anonymousClient().storage.from(DOCUMENTS_BUCKET);
    expect((await anon.download(doc.filePath)).error).not.toBeNull();
    const publicUrl = anon.getPublicUrl(doc.filePath).data.publicUrl;
    expect((await fetch(publicUrl)).status).toBeGreaterThanOrEqual(400);
  });

  it("A supprime son document : fichier, fiche et informations disparaissent ; un ancien lien ne marche plus", async () => {
    const { alice, repoA } = await setup();
    const doc = await importFor(repoA);
    const oldLink = await repoA.fileUrl(doc, "view");
    await repoA.deleteDocument(doc);
    const state = await repoA.load(today);
    expect(state.documents).toEqual([]);
    expect(state.fields).toEqual([]);
    expect((await alice.client.storage.from(DOCUMENTS_BUCKET).download(doc.filePath)).error).not.toBeNull();
    expect((await fetch(oldLink)).status).toBeGreaterThanOrEqual(400);
    await expect(repoA.fileUrl(doc, "view")).rejects.toBeInstanceOf(RepositoryError);
  });

  it("fichiers refusés proprement : format interdit, plus de 20 Mo ; rien n'est créé", async () => {
    const { alice, repoA } = await setup();
    const html = new Blob(["<html>"], { type: "text/html" });
    await expect(repoA.createDocument(draft({ mimeType: "text/html" as AdminDocument["mimeType"], fileSize: html.size }), html, [])).rejects.toMatchObject({
      kind: "validation",
    });
    const big = new Blob([new Uint8Array(20 * 1024 * 1024 + 1)], { type: "application/pdf" });
    await expect(repoA.createDocument(draft({ fileSize: big.size }), big, [])).rejects.toMatchObject({ kind: "validation" });
    expect((await repoA.load(today)).documents).toEqual([]);
    expect((await alice.client.storage.from(DOCUMENTS_BUCKET).list(alice.userId)).data ?? []).toEqual([]);
  });

  it("si la fiche ne peut pas être créée, le fichier envoyé est retiré (aucun fichier orphelin)", async () => {
    const { alice, repoA } = await setup();
    const file = pdfBlob("orphelin ?");
    const id = uuid();
    await expect(repoA.createDocument(draft({ id, title: "   ", fileSize: file.size }), file, [])).rejects.toBeInstanceOf(RepositoryError);
    expect((await alice.client.storage.from(DOCUMENTS_BUCKET).list(`${alice.userId}/${id}`)).data ?? []).toEqual([]);
    expect((await repoA.load(today)).documents).toEqual([]);
  });

  it("informations et échéances : enregistrées, validées, isolées", async () => {
    const { repoA, repoB } = await setup();
    const doc = await importFor(repoA);
    await repoA.saveField({ id: uuid(), documentId: doc.id, key: "salaire_net", amount: 1850.42, status: "valide", source: "utilisateur", validatedAt: new Date().toISOString() });
    const deadline = { id: uuid(), documentId: doc.id, label: "Fin de période d'essai", dueDate: "2027-03-12", kind: "fin_contrat" as const };
    await repoA.saveDeadline(deadline);
    const state = await repoA.load(today);
    expect(state.fields.find((f) => f.key === "salaire_net")).toMatchObject({ amount: 1850.42, status: "valide" });
    expect(state.deadlines).toEqual([{ ...deadline, doneAt: undefined }]);
    expect((await repoB.load(today)).deadlines).toEqual([]);
    await expect(repoB.saveDeadline({ ...deadline, id: uuid(), label: "Intrus" })).rejects.toBeInstanceOf(RepositoryError);
  });
});

suite("dossiers personnels (pile Supabase locale)", () => {
  it("A crée, renomme un dossier et y range un document ; B ne voit rien et ne peut pas y ranger le sien", async () => {
    const { repoA, repoB } = await setup();
    const folder = await repoA.saveFolder({ id: uuid(), name: "  Appartement ", emoji: "🏠", createdAt: "" });
    expect(folder).toMatchObject({ name: "Appartement", emoji: "🏠" });
    const doc = await importFor(repoA, "Bail d'Alice");
    await repoA.updateDocument({ ...doc, folderId: folder.id });

    let state = await repoA.load(today);
    expect(state.folders.map((f) => f.name)).toEqual(["Appartement"]);
    expect(state.documents.find((d) => d.id === doc.id)?.folderId).toBe(folder.id);

    const renamed = await repoA.saveFolder({ ...folder, name: "Mon appartement" });
    expect(renamed.id).toBe(folder.id);
    expect((await repoA.load(today)).folders.map((f) => f.name)).toEqual(["Mon appartement"]);

    // Même nom (majuscules près) : refusé clairement.
    await expect(repoA.saveFolder({ id: uuid(), name: "MON APPARTEMENT", emoji: "📁", createdAt: "" })).rejects.toThrow(/existe déjà/);

    // B : rien de visible, ni renommage, ni rangement de son document dans le dossier de A.
    expect((await repoB.load(today)).folders).toEqual([]);
    await expect(repoB.deleteFolder(folder.id)).rejects.toThrow(RepositoryError);
    const docB = await importFor(repoB, "Facture de Bob");
    await expect(repoB.updateDocument({ ...docB, folderId: folder.id })).rejects.toThrow(RepositoryError);
    await expect(repoB.saveFolder({ ...folder, name: "Piraté" })).rejects.toThrow(RepositoryError);
    expect((await repoA.load(today)).folders.map((f) => f.name)).toEqual(["Mon appartement"]);

    // A supprime le dossier : le document reste, son fichier aussi.
    await repoA.deleteFolder(folder.id);
    state = await repoA.load(today);
    expect(state.folders).toEqual([]);
    const kept = state.documents.find((d) => d.id === doc.id);
    expect(kept?.folderId).toBeUndefined();
    expect((await fetch(await repoA.fileUrl(kept!, "view"))).status).toBe(200);
  });
});
