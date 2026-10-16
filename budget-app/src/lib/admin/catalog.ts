/**
 * Catalogue du module Administratif : catégories, types de documents et informations utiles par type.
 * Volontairement simple : quelques informations typées et vérifiables, pas un moteur générique.
 */
import type { DeadlineKind, DocumentCategory, FieldKind } from "@/types/documents";
import type { Tone } from "@/types/finance";

export interface CategoryInfo {
  id: DocumentCategory;
  label: string;
  emoji: string;
  tone: Tone;
  /** Exemples affichés sous le nom. */
  hint: string;
}

export const documentCategories: CategoryInfo[] = [
  { id: "professionnel", label: "Professionnel", emoji: "💼", tone: "lilac", hint: "Contrats, fiches de paie, attestations" },
  { id: "sante", label: "Santé", emoji: "🩺", tone: "sage", hint: "Mutuelle, ordonnances, remboursements" },
  { id: "impots", label: "Impôts", emoji: "🧾", tone: "peach", hint: "Avis, déclarations, justificatifs" },
  { id: "assurances", label: "Assurances", emoji: "🛡️", tone: "blush", hint: "Habitation, auto, prévoyance" },
];

export function categoryInfo(id: DocumentCategory): CategoryInfo {
  return documentCategories.find((c) => c.id === id) ?? documentCategories[0];
}

export function isDocumentCategory(value: string): value is DocumentCategory {
  return documentCategories.some((c) => c.id === value);
}

export interface FieldDefinition {
  key: string;
  label: string;
  kind: FieldKind;
}

const field = (key: string, label: string, kind: FieldKind): FieldDefinition => ({ key, label, kind });

/** Toutes les informations connues (la clé est enregistrée telle quelle en base). */
export const fieldDefinitions: Record<string, FieldDefinition> = Object.fromEntries(
  [
    field("employeur", "Employeur", "text"),
    field("mois", "Mois", "month"),
    field("salaire_net", "Salaire net", "amount"),
    field("salaire_brut", "Salaire brut", "amount"),
    field("type_contrat", "Type de contrat", "text"),
    field("date_debut", "Date de début", "date"),
    field("date_fin", "Date de fin", "date"),
    field("annee", "Année", "year"),
    field("montant", "Montant", "amount"),
    field("date_limite", "Date limite", "date"),
    field("reference", "Référence", "text"),
    field("assureur", "Assureur", "text"),
    field("contrat", "Numéro de contrat", "text"),
    field("date_echeance", "Date d'échéance", "date"),
    field("organisme", "Organisme", "text"),
    field("date_soin", "Date", "date"),
    field("nature", "Type de document", "text"),
  ].map((f) => [f.key, f]),
);

export interface DocumentTypeInfo {
  id: string;
  category: DocumentCategory;
  label: string;
  /** Mots qui aident la recherche (« voiture » trouve l'assurance automobile). */
  keywords: string;
  /** Informations utiles pour ce type, dans l'ordre d'affichage. */
  fields: string[];
  /** Ce type se rapporte à une période (mois ou année) plutôt qu'à une simple date. */
  period?: "month" | "year";
}

const PAY = ["employeur", "mois", "salaire_net", "salaire_brut"];
const CONTRACT = ["employeur", "type_contrat", "date_debut", "date_fin"];
const TAX = ["annee", "montant", "date_limite", "reference"];
const INSURANCE = ["assureur", "contrat", "date_echeance", "montant"];
const HEALTH = ["organisme", "date_soin", "montant", "nature"];

export const documentTypes: DocumentTypeInfo[] = [
  { id: "fiche_paie", category: "professionnel", label: "Fiche de paie", keywords: "bulletin salaire paie paye", fields: PAY, period: "month" },
  { id: "contrat_travail", category: "professionnel", label: "Contrat de travail", keywords: "cdi cdd embauche", fields: CONTRACT },
  { id: "avenant", category: "professionnel", label: "Avenant", keywords: "avenant contrat", fields: CONTRACT },
  { id: "attestation_employeur", category: "professionnel", label: "Attestation employeur", keywords: "attestation certificat travail", fields: ["employeur"] },
  { id: "autre_pro", category: "professionnel", label: "Autre document professionnel", keywords: "travail emploi", fields: ["employeur"] },

  { id: "mutuelle", category: "sante", label: "Mutuelle", keywords: "complementaire tiers payant carte", fields: ["organisme", "contrat", "date_echeance", "montant"] },
  { id: "ordonnance", category: "sante", label: "Ordonnance", keywords: "medecin prescription", fields: HEALTH },
  { id: "facture_sante", category: "sante", label: "Facture", keywords: "facture soin pharmacie dentiste opticien", fields: HEALTH },
  { id: "remboursement", category: "sante", label: "Remboursement", keywords: "decompte ameli cpam secu", fields: HEALTH },
  { id: "document_medical", category: "sante", label: "Document médical", keywords: "analyse resultat compte rendu radio", fields: HEALTH },
  { id: "autre_sante", category: "sante", label: "Autre document de santé", keywords: "sante medical", fields: HEALTH },

  { id: "avis_imposition", category: "impots", label: "Avis d'imposition", keywords: "impot revenu avis", fields: TAX, period: "year" },
  { id: "declaration", category: "impots", label: "Déclaration", keywords: "declaration revenus 2042", fields: TAX, period: "year" },
  { id: "justificatif_fiscal", category: "impots", label: "Justificatif", keywords: "justificatif recu fiscal", fields: TAX, period: "year" },
  { id: "prelevement_source", category: "impots", label: "Prélèvement à la source", keywords: "taux prelevement source", fields: TAX, period: "year" },
  { id: "autre_impots", category: "impots", label: "Autre document fiscal", keywords: "fiscal taxe fonciere", fields: TAX, period: "year" },

  { id: "assurance_habitation", category: "assurances", label: "Assurance habitation", keywords: "logement maison appartement multirisque", fields: INSURANCE },
  { id: "assurance_auto", category: "assurances", label: "Assurance automobile", keywords: "voiture auto vehicule moto carte verte", fields: INSURANCE },
  { id: "responsabilite_civile", category: "assurances", label: "Responsabilité civile", keywords: "rc civile", fields: INSURANCE },
  { id: "prevoyance", category: "assurances", label: "Prévoyance", keywords: "prevoyance deces invalidite", fields: INSURANCE },
  { id: "autre_assurance", category: "assurances", label: "Autre contrat d'assurance", keywords: "assurance contrat", fields: INSURANCE },
];

export function typesOf(category: DocumentCategory): DocumentTypeInfo[] {
  return documentTypes.filter((t) => t.category === category);
}

/** Type d'un document ; un type inconnu (catalogue plus récent) reste lisible. */
export function typeInfo(id: string, category: DocumentCategory = "professionnel"): DocumentTypeInfo {
  return documentTypes.find((t) => t.id === id) ?? { id, category, label: "Document", keywords: "", fields: [] };
}

/** Type proposé par défaut pour une catégorie (« autre … »). */
export function defaultType(category: DocumentCategory): string {
  const list = typesOf(category);
  return list[list.length - 1].id;
}

export const deadlineKinds: { id: DeadlineKind; label: string }[] = [
  { id: "echeance", label: "Échéance" },
  { id: "fin_contrat", label: "Fin de contrat" },
  { id: "date_limite", label: "Date limite" },
  { id: "renouvellement", label: "Renouvellement" },
  { id: "autre", label: "Autre" },
];

export function deadlineKindLabel(kind: DeadlineKind): string {
  return deadlineKinds.find((k) => k.id === kind)?.label ?? "Échéance";
}

/** Formats et taille acceptés (identiques aux contraintes de la base et de l'espace de stockage). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = "application/pdf,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";
