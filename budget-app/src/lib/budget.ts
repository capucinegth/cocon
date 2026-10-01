/**
 * Calculs d'affichage du prototype (sommes simples, aucune règle métier avancée).
 * Fonctions pures : faciles à tester et à brancher plus tard sur de vraies données.
 */
import { getCategoriesByGroup } from "@/config/categories";
import type { BudgetData } from "@/data";
import type { CategoryGroup, CategoryId, SavingsGoal, Transaction } from "@/types/finance";
import { dayOfMonth, daysInMonth, monthKey } from "./dates";
import { roundCents } from "./format";

type MonthData = Pick<BudgetData, "transactions" | "upcoming" | "today">;

function total(values: number[]): number {
  return roundCents(values.reduce((acc, value) => acc + value, 0));
}

function transactionsOfMonth({ transactions, today }: MonthData): Transaction[] {
  const month = monthKey(today);
  return transactions.filter((t) => monthKey(t.date) === month);
}

export function upcomingOfMonth({ upcoming, today }: MonthData) {
  const month = monthKey(today);
  return upcoming
    .filter((u) => monthKey(u.date) === month && u.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthSummary {
  income: number;
  /** Dépenses déjà passées. */
  paid: number;
  /** Dépenses prévues d'ici la fin du mois. */
  upcoming: number;
  /** paid + upcoming */
  committed: number;
  saved: number;
  /** Ce qui reste réellement à disposition. */
  remaining: number;
  daysLeft: number;
  daysInMonth: number;
  dayOfMonth: number;
  perDay: number;
}

export function getMonthSummary(data: MonthData): MonthSummary {
  const list = transactionsOfMonth(data);
  const byKind = (kind: Transaction["kind"]) => total(list.filter((t) => t.kind === kind).map((t) => t.amount));

  const income = byKind("income");
  const paid = byKind("expense");
  const saved = byKind("saving");
  const upcoming = total(upcomingOfMonth(data).map((u) => u.amount));
  const committed = roundCents(paid + upcoming);
  const remaining = roundCents(income - committed - saved);

  const monthDays = daysInMonth(data.today);
  const day = dayOfMonth(data.today);
  const daysLeft = monthDays - day + 1;

  return {
    income,
    paid,
    upcoming,
    committed,
    saved,
    remaining,
    daysLeft,
    daysInMonth: monthDays,
    dayOfMonth: day,
    perDay: daysLeft > 0 ? remaining / daysLeft : remaining,
  };
}

export interface CategoryUsage {
  categoryId: CategoryId;
  planned: number;
  /** Déjà dépensé / reçu / versé. */
  done: number;
  upcoming: number;
  nextUpcomingDate?: string;
  remaining: number;
  /** (done + upcoming) / planned */
  ratio: number;
}

export function getCategoryUsage(categoryId: CategoryId, data: BudgetData): CategoryUsage {
  const done = total(
    transactionsOfMonth(data)
      .filter((t) => t.categoryId === categoryId)
      .map((t) => t.amount),
  );
  const upcomingItems = upcomingOfMonth(data).filter((u) => u.categoryId === categoryId);
  const upcoming = total(upcomingItems.map((u) => u.amount));
  const planned = data.plan.planned[categoryId] ?? 0;

  return {
    categoryId,
    planned,
    done,
    upcoming,
    nextUpcomingDate: upcomingItems[0]?.date,
    remaining: roundCents(planned - done - upcoming),
    ratio: planned > 0 ? (done + upcoming) / planned : 0,
  };
}

export function getGroupUsage(group: CategoryGroup, data: BudgetData) {
  const lines = getCategoriesByGroup(group).map((category) => getCategoryUsage(category.id, data));
  return {
    lines,
    planned: total(lines.map((l) => l.planned)),
    done: total(lines.map((l) => l.done)),
    upcoming: total(lines.map((l) => l.upcoming)),
  };
}

export type UsageStatus = "ok" | "warning" | "over";

export function getUsageStatus(ratio: number): UsageStatus {
  if (ratio > 1.0001) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

/** Dépenses engagées (passées + prévues) par catégorie, de la plus grosse à la plus petite. */
export function getSpendingByCategory(data: MonthData): { categoryId: CategoryId; amount: number }[] {
  const amounts = new Map<CategoryId, number>();
  const add = (id: CategoryId, amount: number) => amounts.set(id, (amounts.get(id) ?? 0) + amount);

  transactionsOfMonth(data)
    .filter((t) => t.kind === "expense")
    .forEach((t) => add(t.categoryId, t.amount));
  upcomingOfMonth(data).forEach((u) => add(u.categoryId, u.amount));

  return [...amounts.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount: roundCents(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Dépenses déjà passées par catégorie (pour comparer au mois précédent à date). */
export function getPaidByCategory(data: MonthData): Partial<Record<CategoryId, number>> {
  const result: Partial<Record<CategoryId, number>> = {};
  transactionsOfMonth(data)
    .filter((t) => t.kind === "expense")
    .forEach((t) => {
      result[t.categoryId] = roundCents((result[t.categoryId] ?? 0) + t.amount);
    });
  return result;
}

/** Montant signé pour l'affichage : revenus positifs, dépenses et épargne négatives. */
export function signedAmount(t: Pick<Transaction, "amount" | "kind">): number {
  return t.kind === "income" ? t.amount : -t.amount;
}

export interface DayGroup {
  date: string;
  items: Transaction[];
  net: number;
}

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .forEach((t) => groups.set(t.date, [...(groups.get(t.date) ?? []), t]));

  return [...groups.entries()].map(([date, items]) => ({
    date,
    items,
    net: total(items.map(signedAmount)),
  }));
}

/** Répartit l'épargne versée ce mois-ci entre les objectifs, dans l'ordre. */
export function allocateSavings(goals: SavingsGoal[], saved: number): { goal: SavingsGoal; done: number }[] {
  return goals.reduce<{ lines: { goal: SavingsGoal; done: number }[]; left: number }>(
    ({ lines, left }, goal) => {
      const done = Math.min(goal.monthlyContribution, left);
      return { lines: [...lines, { goal, done }], left: roundCents(left - done) };
    },
    { lines: [], left: saved },
  ).lines;
}
