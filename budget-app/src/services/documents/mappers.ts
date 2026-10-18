/** Lignes Supabase ⇄ modèle du module Administratif (centimes ⇄ euros). */
import { fieldDefinitions } from "@/lib/admin/catalog";
import { fromCents, toCents } from "@/services/mappers";
import type { AdminDocument, DocumentDeadline, DocumentField, DocumentFolder } from "@/types/documents";

export interface DocumentRow {
  id: string;
  category: AdminDocument["category"];
  document_type: string;
  title: string;
  description: string;
  file_path: string;
  file_name: string;
  mime_type: AdminDocument["mimeType"];
  file_size_bytes: number | string;
  page_count: number | null;
  document_date: string | null;
  period_year: number | null;
  period_month: number | null;
  classification_status: AdminDocument["classificationStatus"];
  classification_source: AdminDocument["classificationSource"];
  /** Absent tant que la migration « dossiers » n'est pas appliquée. */
  folder_id?: string | null;
  created_at: string;
}

export interface FolderRow {
  id: string;
  name: string;
  emoji: string;
  created_at: string;
}

export interface FieldRow {
  id: string;
  document_id: string;
  field_key: string;
  value_text: string | null;
  value_amount_cents: number | string | null;
  value_date: string | null;
  status: DocumentField["status"];
  source: DocumentField["source"];
  validated_at: string | null;
}

export interface DeadlineRow {
  id: string;
  document_id: string;
  label: string;
  due_date: string;
  kind: DocumentDeadline["kind"];
  done_at: string | null;
}

/** Colonnes d'une fiche avant la migration « dossiers » (toujours présentes). */
export const DOCUMENT_BASE_COLUMNS =
  "id, category, document_type, title, description, file_path, file_name, mime_type, file_size_bytes, page_count, document_date, period_year, period_month, classification_status, classification_source, created_at";
export const DOCUMENT_COLUMNS = `${DOCUMENT_BASE_COLUMNS}, folder_id`;
export const FOLDER_COLUMNS = "id, name, emoji, created_at";
export const FIELD_COLUMNS = "id, document_id, field_key, value_text, value_amount_cents, value_date, status, source, validated_at";
export const DEADLINE_COLUMNS = "id, document_id, label, due_date, kind, done_at";

export function documentFromRow(row: DocumentRow): AdminDocument {
  return {
    id: row.id,
    category: row.category,
    type: row.document_type,
    title: row.title,
    description: row.description,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size_bytes),
    pageCount: row.page_count ?? undefined,
    documentDate: row.document_date ?? undefined,
    periodYear: row.period_year ?? undefined,
    periodMonth: row.period_month ?? undefined,
    classificationStatus: row.classification_status,
    classificationSource: row.classification_source,
    folderId: row.folder_id ?? undefined,
    createdAt: row.created_at,
  };
}

/** Champs modifiables d'une fiche (jamais user_id, jamais le fichier). */
export function documentToRow(doc: AdminDocument) {
  return {
    category: doc.category,
    document_type: doc.type,
    title: doc.title.trim(),
    description: doc.description.trim(),
    document_date: doc.documentDate ?? null,
    period_year: doc.periodYear ?? null,
    period_month: doc.periodYear ? (doc.periodMonth ?? null) : null,
    classification_status: doc.classificationStatus,
    classification_source: doc.classificationSource,
    folder_id: doc.folderId ?? null,
  };
}

/** Nouvelle fiche : identifiant, fichier et champs modifiables (user_id est donné par la base). */
export function newDocumentToRow(doc: AdminDocument) {
  return {
    id: doc.id,
    file_path: doc.filePath,
    file_name: doc.fileName,
    mime_type: doc.mimeType,
    file_size_bytes: doc.fileSize,
    page_count: doc.pageCount ?? null,
    ...documentToRow(doc),
  };
}

export function fieldFromRow(row: FieldRow): DocumentField {
  return {
    id: row.id,
    documentId: row.document_id,
    key: row.field_key,
    text: row.value_text ?? undefined,
    amount: row.value_amount_cents === null ? undefined : fromCents(row.value_amount_cents),
    date: row.value_date ?? undefined,
    status: row.status,
    source: row.source,
    validatedAt: row.validated_at ?? undefined,
  };
}

/** Une seule valeur, dans la colonne correspondant au genre de l'information. */
export function fieldToRow(field: DocumentField) {
  const kind = fieldDefinitions[field.key]?.kind ?? "text";
  return {
    id: field.id,
    document_id: field.documentId,
    field_key: field.key,
    value_text: kind === "text" ? (field.text?.trim() ?? null) : null,
    value_amount_cents: kind === "amount" && field.amount !== undefined ? toCents(field.amount) : null,
    value_date: kind === "date" || kind === "month" || kind === "year" ? (field.date ?? null) : null,
    status: field.status,
    source: field.source,
    validated_at: field.status === "valide" ? (field.validatedAt ?? new Date().toISOString()) : null,
  };
}

export function folderFromRow(row: FolderRow): DocumentFolder {
  return { id: row.id, name: row.name, emoji: row.emoji, createdAt: row.created_at };
}

/** Champs d'un dossier (jamais user_id : la base le donne). */
export function folderToRow(folder: DocumentFolder) {
  return { id: folder.id, name: folder.name.trim(), emoji: folder.emoji };
}

export function deadlineFromRow(row: DeadlineRow): DocumentDeadline {
  return { id: row.id, documentId: row.document_id, label: row.label, dueDate: row.due_date, kind: row.kind, doneAt: row.done_at ?? undefined };
}

export function deadlineToRow(deadline: DocumentDeadline) {
  return {
    id: deadline.id,
    document_id: deadline.documentId,
    label: deadline.label.trim(),
    due_date: deadline.dueDate,
    kind: deadline.kind,
    done_at: deadline.doneAt ?? null,
  };
}
