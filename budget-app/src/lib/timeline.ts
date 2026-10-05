/**
 * Lectures « dans le temps » : calendrier du mois, dépenses jour par jour,
 * évolution du solde et historique mensuel.
 */
import { appConfig } from "@/config/app";
import { findCategory } from "@/config/categories";
import type { BudgetData } from "@/types/budget-data";
import type { MonthHistoryPoint } from "@/types/finance";
import { getMonthSummary, monthTransactions, monthUpcoming, total } from "./budget";
import { dayOfMonth, daysInMonth, monthKey } from "./dates";
import { roundCents } from "./format";

export type CalendarEventType = "income" | "fixed" | "expense" | "saving";

export interface CalendarEvent {
  id: string;
  date: string;
  label: string;
  amount: number;
  type: CalendarEventType;
  /** Mouvement prévu, pas encore passé. */
  planned: boolean;
  categoryId: string;
}

/** Les mouvements qui comptent dans le mois : revenus, charges fixes, grosses dépenses, épargne. */
export function getCalendarEvents(data: BudgetData, month: string): CalendarEvent[] {
  const typeOf = (categoryId: string, kind: "expense" | "income" | "saving"): CalendarEventType => {
    if (kind === "income") return "income";
    if (kind === "saving") return "saving";
    return findCategory(data.categories, categoryId).group === "fixes" ? "fixed" : "expense";
  };

  const past: CalendarEvent[] = monthTransactions(data, month).map((t) => ({
    id: t.id,
    date: t.date,
    label: t.label,
    amount: t.amount,
    type: typeOf(t.categoryId, t.kind),
    planned: false,
    categoryId: t.categoryId,
  }));
  const planned: CalendarEvent[] = monthUpcoming(data, month).map((u) => ({
    id: u.id,
    date: u.date,
    label: u.label,
    amount: u.amount,
    type: typeOf(u.categoryId, u.kind),
    planned: true,
    categoryId: u.categoryId,
  }));

  return [...past, ...planned]
    .filter((e) => e.type !== "expense" || e.amount >= appConfig.largeExpenseThreshold)
    .sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
}

export interface DailySpending {
  day: number;
  date: string;
  /** Dépenses du quotidien déjà passées ce jour-là. */
  amount: number;
  /** Dépenses du quotidien prévues ce jour-là. */
  planned: number;
}

/** Dépenses du quotidien, jour par jour (les charges fixes écraseraient l'échelle). */
export function getDailySpending(data: BudgetData, month: string): DailySpending[] {
  const isVariable = (id: string) => findCategory(data.categories, id).group === "variables";
  const days = daysInMonth(`${month}-01`);
  const spent = new Map<number, number>();
  const planned = new Map<number, number>();
  monthTransactions(data, month)
    .filter((t) => t.kind === "expense" && isVariable(t.categoryId))
    .forEach((t) => spent.set(dayOfMonth(t.date), (spent.get(dayOfMonth(t.date)) ?? 0) + t.amount));
  monthUpcoming(data, month)
    .filter((u) => u.kind === "expense" && isVariable(u.categoryId))
    .forEach((u) => planned.set(dayOfMonth(u.date), (planned.get(dayOfMonth(u.date)) ?? 0) + u.amount));

  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    return {
      day,
      date: `${month}-${String(day).padStart(2, "0")}`,
      amount: roundCents(spent.get(day) ?? 0),
      planned: roundCents(planned.get(day) ?? 0),
    };
  });
}

export interface BalancePoint {
  day: number;
  balance: number;
  /** Point de prévision (après aujourd'hui). */
  projected: boolean;
}

/**
 * Solde du compte jour par jour. Pour le mois en cours, la suite du mois est une
 * prévision : prélèvements à venir + disponible dépensé régulièrement chaque jour.
 */
export function getBalanceSeries(data: BudgetData, month: string): BalancePoint[] {
  const opening = data.openingBalances[month] ?? 0;
  const summary = getMonthSummary(data, month);
  const days = summary.daysInMonth;
  const today = summary.isCurrent ? summary.dayOfMonth : days;

  const movements = new Map<number, number>();
  const add = (day: number, amount: number) => movements.set(day, (movements.get(day) ?? 0) + amount);
  monthTransactions(data, month).forEach((t) => add(dayOfMonth(t.date), t.kind === "income" ? t.amount : -t.amount));
  const upcoming = summary.isCurrent ? monthUpcoming(data, month) : [];
  upcoming.forEach((u) => add(dayOfMonth(u.date), u.kind === "income" ? u.amount : -u.amount));

  // Épargne prévue mais ni versée ni programmée : réservée dès aujourd'hui.
  const savingsUpcoming = total(upcoming.filter((u) => u.kind === "saving").map((u) => u.amount));
  const pendingSavings = Math.max(roundCents(summary.savingsReserved - summary.saved - savingsUpcoming), 0);
  // Revenus attendus d'après le budget mais pas encore saisis : comptés dès demain dans la prévision.
  const expectedIncome = summary.isCurrent ? summary.incomeExpected : 0;
  const dailyAllowance = summary.isCurrent && summary.remaining > 0 ? summary.remaining / summary.daysLeft : 0;

  let balance = opening;
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    balance += movements.get(day) ?? 0;
    if (summary.isCurrent && day === today) balance -= pendingSavings;
    if (summary.isCurrent && day === today + 1) balance += expectedIncome;
    const projected = summary.isCurrent && day > today;
    const value = projected ? balance - dailyAllowance * (day - today + 1) : balance;
    return { day, balance: roundCents(value), projected };
  });
}

/** Historique mensuel : totaux enregistrés, recalculés quand les transactions détaillées existent. */
export function getMonthlyHistory(data: BudgetData): (MonthHistoryPoint & { partial: boolean })[] {
  const current = monthKey(data.today);
  return data.history.map((point) => {
    const detailed = monthTransactions(data, point.month).length > 0;
    if (!detailed) return { ...point, partial: false };
    const summary = getMonthSummary(data, point.month);
    return { ...point, expenses: summary.committed, partial: point.month === current };
  });
}

/** Dépenses mensuelles moyennes des mois complets de l'historique. */
export function averageMonthlyExpenses(history: { expenses: number; partial: boolean }[]): number {
  const complete = history.filter((p) => !p.partial);
  return complete.length ? total(complete.map((p) => p.expenses)) / complete.length : 0;
}
