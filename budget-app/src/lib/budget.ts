/**
 * Calculs d'affichage du prototype (sommes simples, aucune règle métier avancée).
 * Fonctions pures, toutes paramétrées par un mois (AAAA-MM) : faciles à tester
 * et à brancher plus tard sur de vraies données.
 */
import { appConfig } from "@/config/app";
import { findCategory } from "@/config/categories";
import type { BudgetData } from "@/data";
import type { Category, CategoryId, SavingsGoal, Transaction, UpcomingExpense } from "@/types/finance";
import { dayOfMonth, daysInMonth, monthKey } from "./dates";
import { roundCents } from "./format";

export function total(values: number[]): number {
  return roundCents(values.reduce((acc, value) => acc + value, 0));
}

export function monthTransactions(data: Pick<BudgetData, "transactions">, month: string): Transaction[] {
  return data.transactions.filter((t) => monthKey(t.date) === month);
}

/** Mouvements encore à venir dans le mois (uniquement pour le mois en cours). */
export function monthUpcoming(data: Pick<BudgetData, "upcoming" | "today">, month: string): UpcomingExpense[] {
  return data.upcoming
    .filter((u) => monthKey(u.date) === month && u.date >= data.today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Mois consultables : ceux qui ont des transactions détaillées, plus le mois en cours. */
export function availableMonths(data: Pick<BudgetData, "transactions" | "today">): string[] {
  const months = new Set(data.transactions.map((t) => monthKey(t.date)));
  months.add(monthKey(data.today));
  return [...months].sort();
}

const isFixed = (categories: Category[], id: CategoryId) => findCategory(categories, id).group === "fixes";

export type BudgetHealth = "comfortable" | "attention" | "tight" | "closed";

export interface MonthSummary {
  month: string;
  isCurrent: boolean;
  isPast: boolean;
  income: number;
  /** Charges fixes du mois : payées + à venir. */
  fixed: number;
  /** Dépenses du quotidien : déjà dépensées + prévues. */
  variable: number;
  /** Part des charges fixes encore à venir. */
  fixedUpcoming: number;
  /** Part des dépenses du quotidien prévues (pas encore passées). */
  variableUpcoming: number;
  /** Dépenses déjà passées (fixes + quotidien). */
  paid: number;
  /** Tout ce qui est encore à venir dans le mois. */
  upcoming: number;
  /** fixed + variable */
  committed: number;
  /** Épargne déjà versée ce mois-ci. */
  saved: number;
  /** Épargne prévue au budget (ou versée, si c'est plus). */
  savingsReserved: number;
  /** Ce qui reste réellement à disposition (ou ce qu'il est resté, pour un mois passé). */
  remaining: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  /** Disponible par jour (mois en cours) ou dépense quotidienne moyenne (mois passé). */
  perDay: number;
  /** Budget prévu pour les dépenses du quotidien. */
  variableBudget: number;
  health: BudgetHealth;
}

export function getMonthSummary(data: BudgetData, month: string): MonthSummary {
  const current = monthKey(data.today);
  const isCurrent = month === current;
  const isPast = month < current;
  const list = monthTransactions(data, month);
  const upcomingItems = isCurrent ? monthUpcoming(data, month) : [];

  const expenses = list.filter((t) => t.kind === "expense");
  const income = total(list.filter((t) => t.kind === "income").map((t) => t.amount));
  const saved = total(list.filter((t) => t.kind === "saving").map((t) => t.amount));
  const fixed = total([...expenses, ...upcomingItems].filter((t) => isFixed(data.categories, t.categoryId)).map((t) => t.amount));
  const variable = total([...expenses, ...upcomingItems].filter((t) => !isFixed(data.categories, t.categoryId)).map((t) => t.amount));
  const paid = total(expenses.map((t) => t.amount));
  const upcoming = total(upcomingItems.map((u) => u.amount));
  const fixedUpcoming = total(upcomingItems.filter((u) => isFixed(data.categories, u.categoryId)).map((u) => u.amount));
  const variableUpcoming = roundCents(upcoming - fixedUpcoming);

  const plannedSavings = isCurrent ? (data.plan.planned.epargne ?? 0) : 0;
  const savingsReserved = Math.max(plannedSavings, saved);
  const committed = roundCents(fixed + variable);
  const remaining = roundCents(income - committed - savingsReserved);

  const monthDays = daysInMonth(`${month}-01`);
  const day = isCurrent ? dayOfMonth(data.today) : isPast ? monthDays : 1;
  const daysLeft = isCurrent ? monthDays - day + 1 : isPast ? 0 : monthDays;

  const variableBudget = isCurrent
    ? total(data.categories.filter((c) => c.group === "variables").map((c) => data.plan.planned[c.id] ?? 0))
    : variable;
  const perDay = isPast ? variable / monthDays : daysLeft > 0 ? remaining / daysLeft : remaining;

  return {
    month,
    isCurrent,
    isPast,
    income,
    fixed,
    variable,
    fixedUpcoming,
    variableUpcoming,
    paid,
    upcoming,
    committed,
    saved,
    savingsReserved,
    remaining,
    daysInMonth: monthDays,
    dayOfMonth: day,
    daysLeft,
    perDay,
    variableBudget,
    health: isPast ? "closed" : getBudgetHealth(remaining, perDay, variableBudget / monthDays),
  };
}

/** Compare le disponible par jour au budget quotidien moyen prévu. */
export function getBudgetHealth(remaining: number, perDay: number, dailyBudget: number): BudgetHealth {
  if (remaining <= 0 || dailyBudget <= 0) return remaining > 0 ? "comfortable" : "tight";
  const ratio = perDay / dailyBudget;
  if (ratio >= appConfig.healthThresholds.comfortable) return "comfortable";
  if (ratio >= appConfig.healthThresholds.attention) return "attention";
  return "tight";
}

export interface CategoryUsage {
  category: Category;
  planned: number;
  /** Déjà dépensé. */
  done: number;
  upcoming: number;
  nextUpcomingDate?: string;
  remaining: number;
  /** (done + upcoming) / planned */
  ratio: number;
}

export function getCategoryUsage(category: Category, data: BudgetData, month: string): CategoryUsage {
  const done = total(
    monthTransactions(data, month)
      .filter((t) => t.categoryId === category.id && t.kind !== "income")
      .map((t) => t.amount),
  );
  const upcomingItems = monthUpcoming(data, month).filter((u) => u.categoryId === category.id);
  const upcoming = total(upcomingItems.map((u) => u.amount));
  const planned = data.plan.month === month ? (data.plan.planned[category.id] ?? 0) : 0;

  return {
    category,
    planned,
    done,
    upcoming,
    nextUpcomingDate: upcomingItems[0]?.date,
    remaining: roundCents(planned - done - upcoming),
    ratio: planned > 0 ? (done + upcoming) / planned : done + upcoming > 0 ? 1 : 0,
  };
}

/** Catégories de dépenses du budget, dans l'ordre de configuration. */
export function getExpenseUsages(data: BudgetData, month: string): CategoryUsage[] {
  return data.categories
    .filter((c) => c.group === "fixes" || c.group === "variables")
    .map((category) => getCategoryUsage(category, data, month));
}

export type UsageStatus = "ok" | "warning" | "over";

export function getUsageStatus(ratio: number): UsageStatus {
  if (ratio > 1.0001) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

/** Dépenses engagées (passées + prévues) par catégorie, de la plus grosse à la plus petite. */
export function getSpendingByCategory(data: BudgetData, month: string): { category: Category; amount: number }[] {
  const amounts = new Map<CategoryId, number>();
  const add = (id: CategoryId, amount: number) => amounts.set(id, (amounts.get(id) ?? 0) + amount);
  monthTransactions(data, month)
    .filter((t) => t.kind === "expense")
    .forEach((t) => add(t.categoryId, t.amount));
  monthUpcoming(data, month).forEach((u) => add(u.categoryId, u.amount));

  return [...amounts.entries()]
    .map(([id, amount]) => ({ category: findCategory(data.categories, id), amount: roundCents(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/** Dépenses du quotidien déjà passées par catégorie, jusqu'au jour `untilDay` inclus. */
export function getVariablePaidByCategory(data: BudgetData, month: string, untilDay: number): Map<CategoryId, number> {
  const result = new Map<CategoryId, number>();
  monthTransactions(data, month)
    .filter((t) => t.kind === "expense" && !isFixed(data.categories, t.categoryId) && dayOfMonth(t.date) <= untilDay)
    .forEach((t) => result.set(t.categoryId, roundCents((result.get(t.categoryId) ?? 0) + t.amount)));
  return result;
}

export interface MonthComparison {
  previousMonth: string;
  day: number;
  current: number;
  previous: number;
  /** Variation relative (−0,08 = 8 % de moins). */
  delta: number;
  byCategory: { category: Category; current: number; previous: number }[];
}

/** Dépenses du quotidien du mois en cours vs le mois précédent, à la même date. */
export function compareWithPreviousMonth(data: BudgetData): MonthComparison | null {
  const months = availableMonths(data);
  const month = monthKey(data.today);
  const previousMonth = months[months.indexOf(month) - 1];
  if (!previousMonth) return null;

  const day = dayOfMonth(data.today);
  const now = getVariablePaidByCategory(data, month, day);
  const before = getVariablePaidByCategory(data, previousMonth, day);
  const current = total([...now.values()]);
  const previous = total([...before.values()]);
  const ids = new Set([...now.keys(), ...before.keys()]);

  return {
    previousMonth,
    day,
    current,
    previous,
    delta: previous > 0 ? (current - previous) / previous : 0,
    byCategory: [...ids]
      .map((id) => ({ category: findCategory(data.categories, id), current: now.get(id) ?? 0, previous: before.get(id) ?? 0 }))
      .sort((a, b) => Math.max(b.current, b.previous) - Math.max(a.current, a.previous)),
  };
}

/** Montant signé pour l'affichage : revenus positifs, dépenses et épargne négatives. */
export function signedAmount(t: Pick<Transaction, "amount" | "kind">): number {
  return t.kind === "income" ? t.amount : -t.amount;
}

export function sortByDateDesc(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export interface DayGroup {
  date: string;
  items: Transaction[];
  net: number;
}

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  sortByDateDesc(transactions).forEach((t) => groups.set(t.date, [...(groups.get(t.date) ?? []), t]));
  return [...groups.entries()].map(([date, items]) => ({ date, items, net: total(items.map(signedAmount)) }));
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
