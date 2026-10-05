"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { findCategory } from "@/config/categories";
import { getInitialBudgetData, type BudgetData } from "@/data";
import { getMonthSummary, type MonthSummary } from "@/lib/budget";
import { monthKey } from "@/lib/dates";
import { roundCents } from "@/lib/format";
import { slugify } from "@/lib/text";
import type { AccountId, Category, CategoryId, Recurrence, SavingsGoal, Tone, Transaction, TransactionKind } from "@/types/finance";

export interface NewTransactionInput {
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  date: string;
  label?: string;
  recurrence: Recurrence;
  goalId?: string;
}

export interface NewCategoryInput {
  label: string;
  emoji: string;
  group: "fixes" | "variables";
  tone: Tone;
  budget: number;
}

export type NewGoalInput = Omit<SavingsGoal, "id">;

interface BudgetContextValue extends BudgetData {
  currentMonth: string;
  /** Résumé du mois en cours (le plus utilisé). */
  summary: MonthSummary;
  addTransaction: (input: NewTransactionInput) => Transaction;
  removeTransaction: (transaction: Transaction) => void;
  restoreTransaction: (transaction: Transaction) => void;
  addCategory: (input: NewCategoryInput) => Category;
  addGoal: (input: NewGoalInput) => SavingsGoal;
  resetDemo: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

let localId = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(localId++).toString(36)}`;

/** Une opération d'épargne liée à un objectif fait avancer cet objectif. */
function applyToGoals(goals: SavingsGoal[], transaction: Transaction, direction: 1 | -1): SavingsGoal[] {
  if (transaction.kind !== "saving" || !transaction.goalId) return goals;
  return goals.map((goal) =>
    goal.id === transaction.goalId
      ? { ...goal, saved: Math.max(roundCents(goal.saved + direction * transaction.amount), 0) }
      : goal,
  );
}

/**
 * État du prototype, en mémoire uniquement (rien n'est enregistré).
 * Plus tard : remplacé par Supabase (lecture + écriture) derrière la même interface.
 */
export function BudgetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BudgetData>(getInitialBudgetData);

  const { categories, goals } = data;

  const addTransaction = useCallback(
    (input: NewTransactionInput) => {
      const fallback = input.goalId
        ? (goals.find((g) => g.id === input.goalId)?.label ?? "Épargne")
        : findCategory(categories, input.categoryId).label;
      const transaction: Transaction = {
        id: nextId("t"),
        amount: input.amount,
        kind: input.kind,
        categoryId: input.categoryId,
        accountId: input.accountId,
        date: input.date,
        recurrence: input.recurrence,
        goalId: input.goalId,
        label: input.label?.trim() || fallback,
      };
      setData((current) => ({
        ...current,
        transactions: [transaction, ...current.transactions],
        goals: applyToGoals(current.goals, transaction, 1),
      }));
      return transaction;
    },
    [categories, goals],
  );

  /** Supprime une opération ; l'appelant garde l'objet pour pouvoir l'annuler. */
  const removeTransaction = useCallback((transaction: Transaction) => {
    setData((current) =>
      current.transactions.some((t) => t.id === transaction.id)
        ? {
            ...current,
            transactions: current.transactions.filter((t) => t.id !== transaction.id),
            goals: applyToGoals(current.goals, transaction, -1),
          }
        : current,
    );
  }, []);

  const restoreTransaction = useCallback((transaction: Transaction) => {
    setData((current) =>
      current.transactions.some((t) => t.id === transaction.id)
        ? current
        : {
            ...current,
            transactions: [transaction, ...current.transactions],
            goals: applyToGoals(current.goals, transaction, 1),
          },
    );
  }, []);

  const addCategory = useCallback((input: NewCategoryInput) => {
    const category: Category = {
      id: `${slugify(input.label) || "categorie"}-${(localId++).toString(36)}`,
      label: input.label.trim(),
      emoji: input.emoji,
      group: input.group,
      tone: input.tone,
    };
    setData((current) => ({
      ...current,
      categories: [...current.categories, category].sort((a, b) => groupOrder(a) - groupOrder(b)),
      plan: { ...current.plan, planned: { ...current.plan.planned, [category.id]: roundCents(input.budget) } },
    }));
    return category;
  }, []);

  const addGoal = useCallback((input: NewGoalInput) => {
    const goal: SavingsGoal = { ...input, id: nextId("g") };
    setData((current) => ({ ...current, goals: [...current.goals, goal] }));
    return goal;
  }, []);

  const resetDemo = useCallback(() => setData(getInitialBudgetData()), []);

  const value = useMemo<BudgetContextValue>(() => {
    const currentMonth = monthKey(data.today);
    return {
      ...data,
      currentMonth,
      summary: getMonthSummary(data, currentMonth),
      addTransaction,
      removeTransaction,
      restoreTransaction,
      addCategory,
      addGoal,
      resetDemo,
    };
  }, [data, addTransaction, removeTransaction, restoreTransaction, addCategory, addGoal, resetDemo]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

/** Les dépenses avant les revenus et l'épargne ; « Autres » reste en fin de liste des dépenses. */
function groupOrder(category: Category): number {
  if (category.group === "revenus") return 2;
  if (category.group === "epargne") return 3;
  return category.id === "autres" ? 1 : 0;
}

export function useBudget(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("useBudget doit être utilisé dans <BudgetProvider>.");
  return context;
}

/** Raccourci : trouver une catégorie (avec repli sur « Autres »). */
export function useCategoryLookup() {
  const { categories } = useBudget();
  return useCallback((id: CategoryId) => findCategory(categories, id), [categories]);
}
