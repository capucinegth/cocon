/** Petits outils pour construire des jeux de données de test lisibles. */
import { demoAccounts } from "@/config/accounts";
import { defaultCategories } from "@/config/categories";
import { deriveBudgetData } from "@/store/budget-state";
import type { BudgetData, BudgetState } from "@/types/budget-data";
import type { Transaction, TransactionKind } from "@/types/finance";

let counter = 0;

export function tx(date: string, amount: number, kind: TransactionKind, categoryId: string, extra: Partial<Transaction> = {}): Transaction {
  counter += 1;
  return { id: `t${counter}`, label: extra.label ?? categoryId, amount, kind, categoryId, accountId: "courant", date, ...extra };
}

export function makeState(partial: Partial<BudgetState> = {}): BudgetState {
  return {
    today: "2026-09-13",
    categories: defaultCategories,
    accounts: demoAccounts,
    transactions: [],
    recurring: [],
    plans: [],
    goals: [],
    history: null,
    openingBalances: null,
    profile: { id: "u1", displayName: "", preferences: {} },
    ...partial,
  };
}

export function makeData(partial: Partial<BudgetState> = {}): BudgetData {
  return deriveBudgetData(makeState(partial));
}
