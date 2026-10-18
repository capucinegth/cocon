/** Module Administratif : classement par nom de fichier, recherche, échéances, fichiers et PDF. */
import { describe, expect, it } from "vitest";
import { documentTypes, fieldDefinitions, MAX_FILE_BYTES, typeInfo } from "@/lib/admin/catalog";
import { classifyFileName, normalizeFileName, periodFromName, titleFromFileName } from "@/lib/admin/classify";
import {
  documentsToReview,
  formatFieldValue,
  groupDeadlines,
  periodLabel,
  recentDocuments,
  relativeDue,
  searchDocuments,
  summarizeCategory,
  upcomingDeadlines,
} from "@/lib/admin/documents";
import { buildPdfFromJpegs, buildTextPdf, checkFinalSize, checkPhotoDimensions, checkSelectedFile, fitWithin, sniffFileType, storageFileName } from "@/lib/admin/files";
import type { AdminDocument, AdminState, DocumentDeadline, DocumentField } from "@/types/documents";

const today = "2026-10-16";
const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe("classement proposé d'après le nom du fichier", () => {
  it("fiche de paie avec sa période", () => {
    expect(classifyFileName("bulletin_salaire_septembre_2026.pdf", today)).toEqual({
      category: "professionnel",
      type: "fiche_paie",
      periodYear: 2026,
      periodMonth: 9,
      title: "Fiche de paie · septembre 2026",
    });
    expect(classifyFileName("Fiche-de-Paie 2026-03.PDF", today)).toMatchObject({ type: "fiche_paie", periodYear: 2026, periodMonth: 3 });
    expect(classifyFileName("payslip_202605.pdf", today)).toMatchObject({ type: "fiche_paie", periodYear: 2026, periodMonth: 5 });
  });

  it("avis d'imposition avec son année", () => {
    expect(classifyFileName("avis_impot_2026.pdf", today)).toEqual({
      category: "impots",
      type: "avis_imposition",
      periodYear: 2026,
      periodMonth: undefined,
      title: "Avis d'imposition · 2026",
    });
    expect(classifyFileName("Avis d'imposition 2025.pdf", today)).toMatchObject({ type: "avis_imposition", periodYear: 2025 });
  });

  it("santé, assurances, contrats", () => {
    expect(classifyFileName("attestation_mutuelle.pdf", today)).toMatchObject({ category: "sante", type: "mutuelle" });
    expect(classifyFileName("ordonnance-dr-martin.pdf", today)).toMatchObject({ category: "sante", type: "ordonnance" });
    expect(classifyFileName("decompte_ameli_mars.pdf", today)).toMatchObject({ category: "sante", type: "remboursement" });
    expect(classifyFileName("assurance voiture MAIF.pdf", today)).toMatchObject({ category: "assurances", type: "assurance_auto" });
    expect(classifyFileName("Assurance_Habitation_2027.pdf", today)).toMatchObject({ category: "assurances", type: "assurance_habitation" });
    expect(classifyFileName("contrat_de_travail_CDI.pdf", today)).toMatchObject({ category: "professionnel", type: "contrat_travail" });
    expect(classifyFileName("avenant-contrat.pdf", today)).toMatchObject({ type: "avenant" });
    expect(classifyFileName("taxe_fonciere_2026.pdf", today)).toMatchObject({ category: "impots", type: "autre_impots", periodYear: 2026 });
  });

  it("rien de reconnaissable : aucune catégorie inventée", () => {
    for (const name of ["IMG_1234.jpg", "scan.pdf", "document.pdf", "photo.jpeg", "2026.pdf"]) {
      expect(classifyFileName(name, today)).toBeNull();
    }
  });

  it("période : formats courants, années plausibles seulement", () => {
    expect(periodFromName(normalizeFileName("paie_09_2026.pdf"), today)).toEqual({ year: 2026, month: 9 });
    expect(periodFromName(normalizeFileName("paie_2026_9.pdf"), today)).toEqual({ year: 2026, month: 9 });
    expect(periodFromName(normalizeFileName("paie-janv-2026.pdf"), today)).toEqual({ year: 2026, month: 1 });
    expect(periodFromName(normalizeFileName("paie 3000.pdf"), today)).toEqual({ year: undefined, month: undefined });
    // Un mois sans année n'est pas proposé.
    expect(periodFromName(normalizeFileName("paie_septembre.pdf"), today)).toEqual({ year: undefined, month: undefined });
  });

  it("titre lisible d'un nom de fichier", () => {
    expect(titleFromFileName("scan_contrat-2026.pdf")).toBe("Scan contrat 2026");
    expect(titleFromFileName(".pdf")).toBe("Document");
  });

  it("chaque type a une catégorie et des informations connues", () => {
    for (const type of documentTypes) {
      for (const key of type.fields) expect(fieldDefinitions[key], `${type.id}.${key}`).toBeDefined();
    }
    expect(typeInfo("inconnu", "sante")).toMatchObject({ label: "Document", category: "sante" });
  });
});

const doc = (partial: Partial<AdminDocument> & Pick<AdminDocument, "id">): AdminDocument => ({
  category: "professionnel",
  type: "autre_pro",
  title: "Document",
  description: "",
  filePath: `u1/${partial.id}/doc.pdf`,
  fileName: "doc.pdf",
  mimeType: "application/pdf",
  fileSize: 1000,
  classificationStatus: "confirme",
  classificationSource: "utilisateur",
  createdAt: "2026-10-01T10:00:00Z",
  ...partial,
});

const documents = [
  doc({ id: "paie9", type: "fiche_paie", title: "Fiche de paie · septembre 2026", periodYear: 2026, periodMonth: 9, createdAt: "2026-10-02T09:00:00Z" }),
  doc({ id: "paie8", type: "fiche_paie", title: "Fiche de paie · août 2026", periodYear: 2026, periodMonth: 8, createdAt: "2026-09-02T09:00:00Z" }),
  doc({ id: "impot", category: "impots", type: "avis_imposition", title: "Avis d'imposition · 2025", periodYear: 2025, classificationStatus: "a_verifier", createdAt: "2026-09-10T09:00:00Z" }),
  doc({ id: "auto", category: "assurances", type: "assurance_auto", title: "Contrat MAIF", documentDate: "2026-01-15", createdAt: "2026-10-10T09:00:00Z" }),
];
const fields: DocumentField[] = [
  { id: "f1", documentId: "paie9", key: "employeur", text: "Atelier Lumière", status: "valide", source: "utilisateur", validatedAt: "2026-10-02T10:00:00Z" },
  { id: "f2", documentId: "paie9", key: "salaire_net", amount: 1850, status: "valide", source: "utilisateur", validatedAt: "2026-10-02T10:00:00Z" },
  { id: "f3", documentId: "paie8", key: "employeur", text: "Secret SARL", status: "propose", source: "utilisateur" },
];
const deadlines: DocumentDeadline[] = [
  { id: "d1", documentId: "auto", label: "Échéance assurance auto", dueDate: "2026-10-20", kind: "echeance" },
  { id: "d2", documentId: "impot", label: "Paiement du solde", dueDate: "2026-10-10", kind: "date_limite" },
  { id: "d3", documentId: "auto", label: "Renouvellement", dueDate: "2026-11-30", kind: "renouvellement" },
  { id: "d4", documentId: "paie9", label: "Fin de période d'essai", dueDate: "2027-03-12", kind: "fin_contrat" },
  { id: "d5", documentId: "auto", label: "Déjà traitée", dueDate: "2026-10-18", kind: "echeance", doneAt: "2026-10-15T08:00:00Z" },
  { id: "d6", documentId: "auto", label: "Dans 45 jours", dueDate: "2026-11-30", kind: "autre" },
];
const state: AdminState = { today, documents, fields, deadlines, folders: [], foldersEnabled: true };

describe("recherche locale", () => {
  const ids = (q: string) => searchDocuments(state, q).map((d) => d.id);
  it("« salaire » trouve les fiches de paie (mot-clé du type)", () => expect(ids("salaire")).toEqual(["paie9", "paie8"]));
  it("« 2026 » trouve les documents de 2026", () => expect(ids("2026")).toEqual(["paie9", "paie8", "auto"]));
  it("« assurance voiture » trouve le contrat automobile", () => expect(ids("assurance voiture")).toEqual(["auto"]));
  it("« impôt » (avec accent) trouve les documents fiscaux", () => expect(ids("impôt")).toEqual(["impot"]));
  it("les informations VALIDÉES sont cherchables, pas celles à vérifier", () => {
    expect(ids("lumiere")).toEqual(["paie9"]);
    expect(ids("secret")).toEqual([]);
  });
  it("période en toutes lettres", () => expect(ids("septembre")).toEqual(["paie9"]));
  it("requête vide : tous les documents, les plus récents d'abord", () => expect(ids("  ")).toEqual(["paie9", "paie8", "auto", "impot"]));
});

describe("échéances", () => {
  it("regroupées : en retard, 7 jours, 30 jours, 60 jours, plus tard ; les traitées sont exclues", () => {
    expect(groupDeadlines(deadlines, today).map((g) => [g.id, g.items.map((d) => d.id)])).toEqual([
      ["late", ["d2"]],
      ["week", ["d1"]],
      ["twoMonths", ["d3", "d6"]],
      ["later", ["d4"]],
    ]);
  });
  it("à surveiller : en retard ou dans les 60 jours, les plus proches d'abord", () => {
    expect(upcomingDeadlines(deadlines, today).map((d) => d.id)).toEqual(["d2", "d1", "d3"]);
  });
  it("délai lisible", () => {
    expect(relativeDue("2026-10-16", today)).toBe("aujourd'hui");
    expect(relativeDue("2026-10-17", today)).toBe("demain");
    expect(relativeDue("2026-10-20", today)).toBe("dans 4 jours");
    expect(relativeDue("2026-10-10", today)).toBe("il y a 6 jours");
  });
});

describe("accueil « Mes papiers »", () => {
  it("documents à vérifier, ajouts récents, résumé par catégorie", () => {
    expect(documentsToReview(documents).map((d) => d.id)).toEqual(["impot"]);
    expect(recentDocuments(documents).map((d) => d.id)).toEqual(["auto", "paie9", "impot"]);
    expect(summarizeCategory(state, "professionnel")).toMatchObject({ count: 2, toReview: 0, latest: { id: "paie9" }, nextDeadline: { id: "d4" } });
    expect(summarizeCategory(state, "assurances")).toMatchObject({ count: 1, nextDeadline: { id: "d1" } });
    expect(summarizeCategory(state, "sante")).toMatchObject({ count: 0, toReview: 0, latest: undefined });
  });
  it("valeurs et périodes lisibles", () => {
    expect(formatFieldValue(fields[1]).replace(/\s/g, " ")).toBe("1 850 €");
    expect(formatFieldValue({ key: "mois", date: "2026-09-01" })).toBe("Septembre 2026");
    expect(formatFieldValue({ key: "annee", date: "2026-01-01" })).toBe("2026");
    expect(formatFieldValue({ key: "date_echeance", date: "2027-01-03" })).toBe("3 janvier 2027");
    expect(formatFieldValue({ key: "date_echeance", date: "2027-01-01" })).toBe("1er janvier 2027");
    expect(periodLabel(documents[0])).toBe("Septembre 2026");
    expect(periodLabel(documents[2])).toBe("2025");
  });
});

describe("fichiers : vrai format, taille, dimensions", () => {
  it("format reconnu par les premiers octets, pas par l'extension", () => {
    expect(sniffFileType(bytes("%PDF-1.7"))).toBe("pdf");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(sniffFileType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("png");
    expect(sniffFileType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("webp");
    expect(sniffFileType(bytes(0, 0, 0, 0x18, "ftypheic"))).toBe("heic");
    expect(sniffFileType(bytes("MZ", 0x90, 0))).toBe("unknown");
    expect(sniffFileType(bytes("<html>"))).toBe("unknown");
  });
  it("formats réellement produits par l'iPhone : HEIC/HEIF (toutes marques), PDF avec octets avant l'en-tête", () => {
    for (const brand of ["heic", "heix", "heim", "heis", "heif", "hevc", "hevx", "mif1", "msf1"]) {
      expect(sniffFileType(bytes(0, 0, 0, 0x18, `ftyp${brand}`))).toBe("heic");
    }
    // Un PDF peut commencer jusqu'à 1 024 octets plus loin (norme PDF) : son contenu reste vérifié.
    const junk = new Array(700).fill(0x20);
    expect(sniffFileType(bytes(0xef, 0xbb, 0xbf, ...junk, "%PDF-1.7"))).toBe("pdf");
    expect(checkSelectedFile({ size: 2000 }, bytes(...junk, "%PDF-1.4"))).toEqual({ ok: true, kind: "pdf" });
    // Au-delà de 1 024 octets : pas un PDF.
    expect(sniffFileType(bytes(...new Array(1030).fill(0x20), "%PDF-1.4"))).toBe("unknown");
    // Une photo qui contiendrait « %PDF- » dans ses métadonnées reste une photo.
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe1, "Exif %PDF-1.4"))).toBe("jpeg");
    // Le type annoncé (vide sur iPhone, ou faux) n'est jamais utilisé : seul le contenu compte.
    expect(sniffFileType(bytes("<html>%PDF"))).toBe("unknown");
  });
  it("refus propres : vide, trop lourd, format interdit", () => {
    expect(checkSelectedFile({ size: 1200 }, bytes("%PDF-1.4"))).toEqual({ ok: true, kind: "pdf" });
    expect(checkSelectedFile({ size: 1200 }, bytes(0xff, 0xd8, 0xff))).toEqual({ ok: true, kind: "image" });
    expect(checkSelectedFile({ size: 0 }, bytes("%PDF-"))).toEqual({ ok: false, reason: "Ce fichier est vide." });
    expect(checkSelectedFile({ size: MAX_FILE_BYTES + 1 }, bytes("%PDF-"))).toMatchObject({ ok: false, reason: expect.stringContaining("la limite est de 20 Mo") });
    expect(checkSelectedFile({ size: 1200 }, bytes("PK", 3, 4))).toMatchObject({ ok: false, reason: expect.stringContaining("Format non pris en charge") });
    expect(checkFinalSize(MAX_FILE_BYTES)).toBeNull();
    expect(checkFinalSize(MAX_FILE_BYTES + 1)).toContain("Retire une page");
  });
  it("photos : lisibles (≥ 500 px) et redimensionnées sans agrandissement", () => {
    expect(checkPhotoDimensions(480, 900)).toContain("trop petite");
    expect(checkPhotoDimensions(1200, 1600)).toBeNull();
    expect(fitWithin(4032, 3024)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(1000, 1400)).toEqual({ width: 1000, height: 1400 });
  });
  it("nom de stockage sûr (ASCII, sans chemin)", () => {
    expect(storageFileName("Fiche de paie · septembre 2026", "pdf")).toBe("fiche-de-paie-septembre-2026.pdf");
    expect(storageFileName("../../etc/passwd", "pdf")).toBe("etc-passwd.pdf");
    expect(storageFileName("···", "pdf")).toBe("document.pdf");
  });
});

describe("PDF assemblé à partir des photos", () => {
  const jpeg = (n: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, n, n, n, 0xff, 0xd9]);
  const text = (pdf: Uint8Array) => Buffer.from(pdf).toString("latin1");

  it("une page par photo, dans l'ordre, avec une table de références exacte", () => {
    const pdf = buildPdfFromJpegs([
      { bytes: jpeg(1), width: 1200, height: 1600 },
      { bytes: jpeg(2), width: 1600, height: 1200 },
      { bytes: jpeg(3), width: 1000, height: 1414 },
    ]);
    const content = text(pdf);
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("/Count 3");
    expect(content.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(content.match(/\/Filter \/DCTDecode/g)).toHaveLength(3);
    // Chaque entrée de la table pointe exactement sur le début de son objet.
    const xrefAt = Number(content.match(/startxref\n(\d+)/)![1]);
    const entries = content.slice(xrefAt).split("\n").slice(3).filter((l) => l.endsWith(" n ")).map((l) => Number(l.slice(0, 10)));
    entries.forEach((offset, i) => expect(content.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
    expect(entries).toHaveLength(2 + 3 * 3);
    // Pages dans l'ordre des photos.
    const first = content.indexOf(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1));
    const second = content.indexOf(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 2));
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });

  it("aucune page : refus", () => expect(() => buildPdfFromJpegs([])).toThrow());

  it("PDF texte de démonstration (accents latin-1)", () => {
    const content = text(buildTextPdf(["Fiche de paie", "Période : août (exemple)"]));
    expect(content).toContain("(Fiche de paie) Tj");
    expect(content).toContain("(Période : août \\(exemple\\)) Tj");
    expect(sniffFileType(buildTextPdf(["x"]))).toBe("pdf");
  });
});
