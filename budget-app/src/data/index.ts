import { appConfig } from "@/config/app";
import { defaultCategories } from "@/config/categories";
import type {
  BudgetPlan,
  Category,
  MonthHistoryPoint,
  SavingsGoal,
  Transaction,
  UpcomingExpense,
} from "@/types/finance";
import {
  demoBudgetPlan,
  demoGoals,
  demoHistory,
  demoOpeningBalances,
  demoTransactions,
  demoUpcoming,
} from "./demo-data";

export interface BudgetData {
  today: string;
  categories: Category[];
  transactions: Transaction[];
  upcoming: UpcomingExpense[];
  plan: BudgetPlan;
  goals: SavingsGoal[];
  history: MonthHistoryPoint[];
  openingBalances: Record<string, number>;
}

/**
 * Point d'entrée unique des données.
 * Aujourd'hui : données de démonstration.
 * Plus tard : lecture depuis Supabase (même forme de retour), sans toucher aux écrans.
 */
export function getInitialBudgetData(): BudgetData {
  return {
    today: appConfig.demoToday,
    categories: defaultCategories,
    transactions: demoTransactions,
    upcoming: demoUpcoming,
    plan: demoBudgetPlan,
    goals: demoGoals,
    history: demoHistory,
    openingBalances: demoOpeningBalances,
  };
}
