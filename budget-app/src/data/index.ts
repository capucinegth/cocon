import { appConfig } from "@/config/app";
import { demoAccounts } from "@/config/accounts";
import { defaultCategories } from "@/config/categories";
import type { BudgetState } from "@/types/budget-data";
import {
  demoBudgetPlans,
  demoGoals,
  demoHistory,
  demoOpeningBalances,
  demoRecurring,
  demoTransactions,
} from "./demo-data";

/**
 * Données de démonstration (mode démo uniquement) : jamais mélangées aux données
 * réelles, jamais envoyées en base. Une copie neuve à chaque appel.
 */
export function getDemoState(): BudgetState {
  return structuredClone({
    today: appConfig.demoToday,
    categories: defaultCategories,
    accounts: demoAccounts,
    transactions: demoTransactions,
    recurring: demoRecurring,
    plans: demoBudgetPlans,
    goals: demoGoals,
    history: demoHistory,
    openingBalances: demoOpeningBalances,
    // Démo : le tuto ne s'ouvre pas tout seul (il reste accessible depuis Paramètres → Aide).
    profile: { id: "demo", displayName: "", preferences: { tutorialSeen: true } },
  });
}
