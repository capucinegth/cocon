/**
 * Dépôt de démonstration : données fictives, en mémoire uniquement.
 * Rien n'est envoyé ni enregistré ; « Réinitialiser la démo » repart des données d'exemple.
 */
import { getDemoState } from "@/data";
import { uuid } from "@/lib/ids";
import { materializeRecurring } from "@/lib/recurrence";
import type { BudgetState } from "@/types/budget-data";
import type { BudgetRepository } from "./repository";

const done = async () => {};

/** État de démo prêt à l'emploi (récurrences dues générées, comme le ferait la base). */
export function createDemoState(): BudgetState {
  const state = getDemoState();
  const { transactions, rules } = materializeRecurring(state.recurring, state.transactions, state.today, uuid);
  return { ...state, transactions, recurring: rules };
}

export function createDemoRepository(): BudgetRepository {
  return {
    source: "demo",
    load: async () => createDemoState(),
    createTransaction: done,
    updateTransaction: done,
    deleteTransaction: done,
    createCategory: done,
    updateCategory: done,
    archiveCategory: done,
    setCategoryBudget: done,
    setMonthTargets: done,
    createGoal: done,
    updateGoal: done,
    deleteGoal: done,
    updateRecurring: done,
    deleteRecurring: done,
    updateProfile: done,
  };
}
