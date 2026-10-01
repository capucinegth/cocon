"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getCategory } from "@/config/categories";
import { getInitialBudgetData, type BudgetData } from "@/data";
import { getMonthSummary, type MonthSummary } from "@/lib/budget";
import type { AccountId, CategoryId, Transaction, TransactionKind } from "@/types/finance";

export interface NewTransactionInput {
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  date: string;
  note?: string;
}

interface BudgetContextValue extends BudgetData {
  summary: MonthSummary;
  addTransaction: (input: NewTransactionInput) => Transaction;
  resetDemo: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

/**
 * État du prototype, en mémoire uniquement (rien n'est enregistré).
 * Plus tard : remplacé par Supabase (lecture + écriture) derrière la même interface.
 */
export function BudgetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BudgetData>(getInitialBudgetData);

  const addTransaction = useCallback((input: NewTransactionInput) => {
    const note = input.note?.trim();
    const transaction: Transaction = {
      ...input,
      id: `local-${Date.now()}`,
      label: note || getCategory(input.categoryId).label,
      note: undefined,
    };
    setData((current) => ({ ...current, transactions: [transaction, ...current.transactions] }));
    return transaction;
  }, []);

  const resetDemo = useCallback(() => setData(getInitialBudgetData()), []);

  const value = useMemo<BudgetContextValue>(
    () => ({ ...data, summary: getMonthSummary(data), addTransaction, resetDemo }),
    [data, addTransaction, resetDemo],
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("useBudget doit être utilisé dans <BudgetProvider>.");
  return context;
}
