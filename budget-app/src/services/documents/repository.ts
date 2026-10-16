/**
 * Accès aux documents administratifs — séparé du dépôt du Budget : son chargement n'a lieu
 * que dans « Mes papiers » et ne touche jamais aux données financières.
 *
 * Deux implémentations, jamais mélangées : démo (en mémoire) et Supabase (tables protégées
 * par la RLS + espace de stockage PRIVÉ « documents », liens temporaires uniquement).
 */
import type { DataSource } from "@/lib/supabase/env";
import type { AdminDocument, AdminState, DocumentDeadline, DocumentField } from "@/types/documents";

/** Nouveau document, avant l'envoi : le chemin de stockage est attribué par le dépôt. */
export type DocumentDraft = Omit<AdminDocument, "filePath" | "createdAt">;

export interface DocumentRepository {
  readonly source: DataSource;
  load(today: string): Promise<AdminState>;

  /** Envoie le fichier dans l'espace privé PUIS crée la fiche ; rien ne reste à moitié créé. */
  createDocument(draft: DocumentDraft, file: Blob, fields: DocumentField[]): Promise<AdminDocument>;
  /** Fiche seulement (titre, classement, dates…) ; le fichier n'est jamais modifié. */
  updateDocument(document: AdminDocument): Promise<void>;
  /** Supprime le fichier PUIS la fiche (et ses informations et échéances) ; échoue sans rien prétendre. */
  deleteDocument(document: AdminDocument): Promise<void>;
  /** Lien temporaire (60 s) pour consulter ou télécharger le fichier. Jamais d'URL permanente. */
  fileUrl(document: AdminDocument, mode: "view" | "download"): Promise<string>;

  /** Crée ou remplace l'information `key` d'un document. */
  saveField(field: DocumentField): Promise<void>;
  deleteField(field: DocumentField): Promise<void>;

  saveDeadline(deadline: DocumentDeadline): Promise<void>;
  deleteDeadline(deadlineId: string): Promise<void>;
}

/** Durée de validité des liens temporaires (secondes) : le fichier s'ouvre aussitôt après. */
export const SIGNED_URL_SECONDS = 60;
