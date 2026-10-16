/**
 * Module « Administratif » (Mes papiers) : documents, informations vérifiables, échéances.
 * Indépendant des types financiers : rien ici ne modifie le Budget.
 */

export type DocumentCategory = "professionnel" | "sante" | "impots" | "assurances";

/** Formats acceptés dans l'espace privé (les photos sont assemblées en PDF avant l'envoi). */
export type DocumentMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export interface AdminDocument {
  id: string;
  category: DocumentCategory;
  /** Type précis, voir `lib/admin/catalog.ts` (fiche_paie, avis_imposition…). */
  type: string;
  title: string;
  description: string;
  /** Chemin dans l'espace privé : <user_id>/<document_id>/<nom>. Jamais une URL. */
  filePath: string;
  fileName: string;
  mimeType: DocumentMimeType;
  fileSize: number;
  pageCount?: number;
  /** Date du document (AAAA-MM-JJ). */
  documentDate?: string;
  periodYear?: number;
  periodMonth?: number;
  /** Classement proposé par Cocon : « à vérifier » tant que l'utilisateur ne l'a pas confirmé. */
  classificationStatus: "a_verifier" | "confirme";
  classificationSource: "nom_fichier" | "utilisateur";
  /** Horodatage ISO complet. */
  createdAt: string;
}

export type FieldKind = "text" | "amount" | "date" | "month" | "year";

/**
 * Une information d'un document (employeur, salaire net, date d'échéance…).
 * « propose » : à vérifier ; « valide » : confirmée par l'utilisateur. Seule une information
 * validée pourra un jour servir ailleurs dans Cocon, et jamais automatiquement.
 */
export interface DocumentField {
  id: string;
  documentId: string;
  key: string;
  /** Texte (kind text), montant en euros (amount), date AAAA-MM-JJ (date, month = le 1er, year = le 1er janvier). */
  text?: string;
  amount?: number;
  date?: string;
  status: "propose" | "valide";
  source: "nom_fichier" | "utilisateur" | "extraction";
  validatedAt?: string;
}

export type DeadlineKind = "echeance" | "fin_contrat" | "date_limite" | "renouvellement" | "autre";

export interface DocumentDeadline {
  id: string;
  documentId: string;
  label: string;
  dueDate: string;
  kind: DeadlineKind;
  /** Échéance traitée (horodatage ISO). */
  doneAt?: string;
}

export interface AdminState {
  today: string;
  documents: AdminDocument[];
  fields: DocumentField[];
  deadlines: DocumentDeadline[];
}
