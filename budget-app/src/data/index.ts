import { appConfig } from "@/config/app";
import type {
  BudgetPlan,
  MonthHistoryPoint,
  PreviousMonthToDate,
  SavingsGoal,
  Transaction,
  UpcomingExpense,
} from "@/types/finance";
import {
  demoBudgetPlan,
  demoGoals,
  demoHistory,
  demoPreviousMonthToDate,
  demoTransactions,
  demoUpcoming,
} from "./demo-data";

export interface BudgetData {
  today: string;
  transactions: Transaction[];
  upcoming: UpcomingExpense[];
  plan: BudgetPlan;
  goals: SavingsGoal[];
  history: MonthHistoryPoint[];
  previousMonthToDate: PreviousMonthToDate;
}

/**
 * Point d'entrée unique des données.
 * Aujourd'hui : données de démonstration.
 * Plus tard : lecture depuis Supabase (même forme de retour), sans toucher aux écrans.
 */
export function getInitialBudgetData(): BudgetData {
  return {
    today: appConfig.demoToday,
    transactions: demoTransactions,
    upcoming: demoUpcoming,
    plan: demoBudgetPlan,
    goals: demoGoals,
    history: demoHistory,
    previousMonthToDate: demoPreviousMonthToDate,
  };
}
