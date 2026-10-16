/**
 * Lecture des documents (fonctions pures) : informations, période, recherche, échéances, résumé par catégorie.
 */
import type { AdminDocument, AdminState, DocumentCategory, DocumentDeadline, DocumentField } from "@/types/documents";
import { addDays, formatMonth } from "../dates";
import { formatMoney } from "../format";
import { normalizeText } from "../text";
import { categoryInfo, fieldDefinitions, typeInfo } from "./catalog";

const FULL_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const SHORT_DATE_YEAR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const firstDay = (text: string) => text.replace(/^1 /, "1er ");

/** « 3 janvier 2027 » : pour des papiers, l'année compte toujours. */
export function formatDocDate(iso: string): string {
  return firstDay(FULL_DATE.format(new Date(`${iso}T00:00:00Z`)));
}

/** « 3 janv. » cette année, « 3 janv. 2027 » sinon. */
export function formatDocShortDate(iso: string, today: string): string {
  const format = iso.slice(0, 4) === today.slice(0, 4) ? SHORT_DATE : SHORT_DATE_YEAR;
  return firstDay(format.format(new Date(`${iso}T00:00:00Z`)));
}

/** Valeur lisible d'une information (montant, date, mois, année ou texte). */
export function formatFieldValue(field: Pick<DocumentField, "key" | "text" | "amount" | "date">): string {
  const kind = fieldDefinitions[field.key]?.kind ?? "text";
  if (kind === "amount" && field.amount !== undefined) return formatMoney(field.amount, { cents: "auto" });
  if (field.date) {
    if (kind === "month") return formatMonth(field.date.slice(0, 7));
    if (kind === "year") return field.date.slice(0, 4);
    return formatDocDate(field.date);
  }
  return field.text ?? "";
}

/** Période d'un document : « Septembre 2026 », « 2026 », ou rien. */
export function periodLabel(doc: Pick<AdminDocument, "periodYear" | "periodMonth">): string {
  if (doc.periodYear && doc.periodMonth) return formatMonth(`${doc.periodYear}-${String(doc.periodMonth).padStart(2, "0")}`);
  return doc.periodYear ? String(doc.periodYear) : "";
}

/** Année de référence d'un document : sa période, sinon sa date, sinon son ajout. */
export function documentYear(doc: AdminDocument): number {
  return doc.periodYear ?? Number((doc.documentDate ?? doc.createdAt).slice(0, 4));
}

export function documentsOf(state: Pick<AdminState, "documents">, category: DocumentCategory): AdminDocument[] {
  return sortDocuments(state.documents.filter((d) => d.category === category));
}

/** Les plus récents d'abord : période, date du document, puis date d'ajout. */
export function sortDocuments(documents: AdminDocument[]): AdminDocument[] {
  const key = (d: AdminDocument) =>
    d.periodYear ? `${d.periodYear}-${String(d.periodMonth ?? 12).padStart(2, "0")}-31` : (d.documentDate ?? d.createdAt.slice(0, 10));
  return [...documents].sort((a, b) => key(b).localeCompare(key(a)) || b.createdAt.localeCompare(a.createdAt));
}

/** Documents dont le classement proposé reste à vérifier. */
export function documentsToReview(documents: AdminDocument[]): AdminDocument[] {
  return documents.filter((d) => d.classificationStatus === "a_verifier");
}

/**
 * Recherche locale, sans accents : chaque mot doit apparaître dans le titre, le type (et ses mots-clés),
 * la catégorie, l'année, la période, le nom du fichier, la description ou une information VALIDÉE.
 */
export function searchDocuments(state: Pick<AdminState, "documents" | "fields">, query: string): AdminDocument[] {
  const words = normalizeText(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return sortDocuments(state.documents);
  return sortDocuments(
    state.documents.filter((doc) => {
      const type = typeInfo(doc.type, doc.category);
      const validated = state.fields.filter((f) => f.documentId === doc.id && f.status === "valide").map((f) => formatFieldValue(f));
      const haystack = normalizeText(
        [doc.title, doc.description, doc.fileName, type.label, type.keywords, categoryInfo(doc.category).label, periodLabel(doc), documentYear(doc), doc.documentDate ?? "", ...validated].join(" "),
      );
      return words.every((word) => haystack.includes(word));
    }),
  );
}

export type DeadlineGroupId = "late" | "week" | "month" | "twoMonths" | "later";

export const deadlineGroupLabels: Record<DeadlineGroupId, string> = {
  late: "En retard",
  week: "Dans les 7 jours",
  month: "Dans les 30 jours",
  twoMonths: "Dans les 60 jours",
  later: "Plus tard",
};

/** Échéances non traitées, regroupées par proximité (les dates passées d'abord, « en retard »). */
export function groupDeadlines(deadlines: DocumentDeadline[], today: string): { id: DeadlineGroupId; items: DocumentDeadline[] }[] {
  const pending = deadlines.filter((d) => !d.doneAt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const groupOf = (date: string): DeadlineGroupId =>
    date < today ? "late" : date <= addDays(today, 7) ? "week" : date <= addDays(today, 30) ? "month" : date <= addDays(today, 60) ? "twoMonths" : "later";
  const order: DeadlineGroupId[] = ["late", "week", "month", "twoMonths", "later"];
  return order.map((id) => ({ id, items: pending.filter((d) => groupOf(d.dueDate) === id) })).filter((g) => g.items.length > 0);
}

/** Prochaines échéances à surveiller (en retard ou dans les 60 jours), les plus proches d'abord. */
export function upcomingDeadlines(deadlines: DocumentDeadline[], today: string, limit = 3): DocumentDeadline[] {
  const horizon = addDays(today, 60);
  return deadlines
    .filter((d) => !d.doneAt && d.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
}

/** Documents ajoutés récemment (les plus récents d'abord). */
export function recentDocuments(documents: AdminDocument[], limit = 3): AdminDocument[] {
  return [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export interface CategorySummary {
  category: DocumentCategory;
  count: number;
  toReview: number;
  /** Prochaine échéance non traitée de la catégorie. */
  nextDeadline?: DocumentDeadline;
  /** Dernier document (période / date la plus récente). */
  latest?: AdminDocument;
}

export function summarizeCategory(state: AdminState, category: DocumentCategory): CategorySummary {
  const docs = documentsOf(state, category);
  const ids = new Set(docs.map((d) => d.id));
  const nextDeadline = state.deadlines
    .filter((d) => ids.has(d.documentId) && !d.doneAt && d.dueDate >= state.today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return { category, count: docs.length, toReview: documentsToReview(docs).length, nextDeadline, latest: docs[0] };
}

/** « dans 3 jours », « aujourd'hui », « il y a 2 jours ». */
export function relativeDue(date: string, today: string): string {
  const diff = Math.round((Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 86_400_000);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  return diff > 0 ? `dans ${diff} jours` : `il y a ${-diff} jours`;
}
