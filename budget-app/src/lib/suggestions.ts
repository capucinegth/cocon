/**
 * Suggestions locales pour l'ajout rapide (fonctions pures, déterministes, sans service externe) :
 * catégories les plus utilisées, et ce qu'on a déjà associé à un même marchand (catégorie, compte).
 */
import type { AccountId, CategoryId, Transaction, TransactionKind } from "@/types/finance";
import { addDays } from "./dates";
import { normalizeText } from "./text";

type Past = Pick<Transaction, "label" | "kind" | "categoryId" | "accountId" | "date">;

/** Fenêtre d'habitudes : les 120 derniers jours. */
const WINDOW_DAYS = 120;

/** Clé d'un marchand : sans accents, ponctuation ni espaces en trop (« CARREFOUR  City » = « carrefour city »). */
export function merchantKey(label: string): string {
  return normalizeText(label)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recentOfKind(history: Past[], kind: TransactionKind, today: string): Past[] {
  const from = addDays(today, -WINDOW_DAYS);
  return history.filter((t) => t.kind === kind && t.date <= today && t.date >= from);
}

/**
 * Catégories classées par usage récent (nombre d'opérations, puis la plus récente),
 * limitées à `allowed` (catégories proposées dans le formulaire, dans leur ordre).
 */
export function rankCategories(history: Past[], kind: TransactionKind, today: string, allowed: CategoryId[]): CategoryId[] {
  const stats = new Map<CategoryId, { count: number; last: string }>();
  for (const t of recentOfKind(history, kind, today)) {
    const s = stats.get(t.categoryId) ?? { count: 0, last: "" };
    stats.set(t.categoryId, { count: s.count + 1, last: t.date > s.last ? t.date : s.last });
  }
  const order = new Map(allowed.map((id, index) => [id, index]));
  return [...allowed].sort((a, b) => {
    const sa = stats.get(a);
    const sb = stats.get(b);
    if (sa && sb) return sb.count - sa.count || sb.last.localeCompare(sa.last) || order.get(a)! - order.get(b)!;
    if (sa || sb) return sa ? -1 : 1;
    return order.get(a)! - order.get(b)!;
  });
}

export interface MerchantMatch {
  label: string;
  categoryId: CategoryId;
  accountId: AccountId;
}

/** Dernière opération du même type pour ce marchand (toute l'histoire : un marchand rare reste reconnu). */
export function matchMerchant(history: Past[], kind: TransactionKind, label: string, today: string): MerchantMatch | null {
  const key = merchantKey(label);
  if (key.length < 2) return null;
  const last = history
    .filter((t) => t.kind === kind && t.date <= today && merchantKey(t.label) === key)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return last ? { label: last.label, categoryId: last.categoryId, accountId: last.accountId } : null;
}

/** Libellés déjà utilisés pour ce type d'opération, du plus fréquent au moins fréquent (pour l'auto-complétion). */
export function knownLabels(history: Past[], kind: TransactionKind, today: string, limit = 30): string[] {
  const counts = new Map<string, { label: string; count: number; last: string }>();
  for (const t of history) {
    if (t.kind !== kind || t.date > today || !t.label.trim()) continue;
    const key = merchantKey(t.label);
    const s = counts.get(key);
    if (!s) counts.set(key, { label: t.label.trim(), count: 1, last: t.date });
    else counts.set(key, { label: t.date > s.last ? t.label.trim() : s.label, count: s.count + 1, last: t.date > s.last ? t.date : s.last });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((s) => s.label);
}
