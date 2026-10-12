"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { findCategory } from "@/config/categories";
import { appConfig } from "@/config/app";
import { moveInOrder } from "@/lib/accounts";
import { getMonthSummary, type MonthSummary } from "@/lib/budget";
import { monthKey } from "@/lib/dates";
import { uuid } from "@/lib/ids";
import { todayInParis } from "@/lib/paris-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dataSource, type DataSource } from "@/lib/supabase/env";
import { createDemoRepository, createDemoState } from "@/services/demo-repository";
import { errorMessage, isSessionError, type BudgetRepository } from "@/services/repository";
import { createSupabaseRepository } from "@/services/supabase-repository";
import type { BudgetData, BudgetState } from "@/types/budget-data";
import type { AccountId, Category, CategoryId, Preferences, SavingsGoal, Transaction } from "@/types/finance";
import {
  buildCategory,
  buildGoal,
  buildTransaction,
  deriveBudgetData,
  editTransaction,
  resolveRecurringPatch,
  withArchivedCategory,
  withCategory,
  withCategoryBudget,
  withEditedTransaction,
  withGoal,
  withMonthTargets,
  withoutGoal,
  withoutRecurring,
  withoutTransaction,
  withProfile,
  withTransaction,
  withUpdatedCategory,
  withUpdatedGoal,
  withUpdatedRecurring,
  withAccountOrder,
  withUpdatedAccount,
  type AccountPatch,
  type CategoryInput,
  type GoalInput,
  type MonthTargets,
  type ProfilePatch,
  type RecurringPatch,
  type TransactionInput,
} from "./budget-state";
import { useSession } from "./session-store";

export type NewTransactionInput = TransactionInput;
export type NewCategoryInput = CategoryInput & { budget: number };
export type NewGoalInput = GoalInput;

export type LoadStatus = "loading" | "ready" | "error";

interface BudgetContextValue extends BudgetData {
  source: DataSource;
  status: LoadStatus;
  loadError: string | null;
  currentMonth: string;
  /** Résumé du mois en cours (le plus utilisé). */
  summary: MonthSummary;
  /** Toutes les opérations, y compris celles datées dans le futur. */
  allTransactions: Transaction[];
  reload: () => Promise<void>;
  addTransaction: (input: NewTransactionInput) => Promise<Transaction>;
  updateTransaction: (original: Transaction, input: Omit<NewTransactionInput, "recurrence">) => Promise<Transaction>;
  /** `withRecurrence` : supprime aussi la règle créée avec l'opération (annulation d'un ajout). */
  removeTransaction: (transaction: Transaction, options?: { withRecurrence?: boolean }) => Promise<void>;
  restoreTransaction: (transaction: Transaction) => Promise<void>;
  addCategory: (input: NewCategoryInput, month?: string) => Promise<Category>;
  updateCategory: (id: CategoryId, patch: Partial<Pick<Category, "label" | "emoji" | "tone">>) => Promise<void>;
  archiveCategory: (id: CategoryId) => Promise<void>;
  setCategoryBudget: (month: string, categoryId: CategoryId, amount: number) => Promise<void>;
  setMonthTargets: (month: string, targets: MonthTargets) => Promise<void>;
  addGoal: (input: NewGoalInput) => Promise<SavingsGoal>;
  updateGoal: (id: string, patch: Partial<GoalInput>) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
  updateRecurring: (id: string, patch: RecurringPatch) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
  updateProfile: (patch: { displayName?: string; preferences?: Preferences }) => Promise<void>;
  updateAccount: (id: AccountId, patch: AccountPatch) => Promise<void>;
  /** Déplace un compte à une position (0 = en premier) dans l'ordre d'affichage. */
  moveAccount: (id: AccountId, toIndex: number) => Promise<void>;
  resetDemo: () => void;
}

const BudgetContext = createContext<BudgetContextValue | null>(null);

function emptyState(today: string): BudgetState {
  return {
    today,
    categories: [],
    accounts: [],
    transactions: [],
    recurring: [],
    plans: [],
    goals: [],
    history: null,
    openingBalances: null,
    profile: null,
  };
}

function createRepository(): BudgetRepository {
  return dataSource === "supabase" ? createSupabaseRepository(getSupabaseBrowserClient()) : createDemoRepository();
}

/** Au retour sur l'onglet, on recharge si la date a changé ou si les données datent un peu (autre appareil). */
const REFRESH_AFTER_MS = 60_000;

/**
 * Données de Cocon. Chaque modification est d'abord enregistrée (base ou démo),
 * puis appliquée à l'écran : en cas d'erreur, rien ne change et l'erreur est remontée
 * au formulaire, qui garde la saisie.
 */
export function BudgetProvider({ children }: { children: ReactNode }) {
  const { handleSessionExpired } = useSession();
  const [repository] = useState(createRepository);
  const isDemo = repository.source === "demo";
  const [state, setState] = useState<BudgetState | null>(() => (isDemo ? createDemoState() : null));
  const [status, setStatus] = useState<LoadStatus>(isDemo ? "ready" : "loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const loadedAt = useRef(0);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fail = useCallback(
    (error: unknown): never => {
      if (isSessionError(error)) handleSessionExpired();
      throw error;
    },
    [handleSessionExpired],
  );

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setStatus("loading");
      try {
        const next = await repository.load(todayInParis());
        loadedAt.current = Date.now();
        setState(next);
        setStatus("ready");
        setLoadError(null);
      } catch (error) {
        if (isSessionError(error)) return handleSessionExpired();
        // Un rafraîchissement discret raté n'efface pas les données affichées.
        if (silent && stateRef.current) return;
        setLoadError(errorMessage(error));
        setStatus("error");
      }
    },
    [repository, handleSessionExpired],
  );

  useEffect(() => {
    if (isDemo) return;
    // Chargement initial des données (Supabase) : asynchrone, après le premier rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !stateRef.current) return;
      const dayChanged = stateRef.current.today !== todayInParis();
      if (dayChanged || Date.now() - loadedAt.current > REFRESH_AFTER_MS) void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isDemo, load]);

  const reload = useCallback(() => load(false), [load]);

  /** Enregistre puis applique ; rien n'est modifié à l'écran si l'enregistrement échoue. */
  const commit = useCallback(
    async (persist: () => Promise<void>, apply: (current: BudgetState) => BudgetState) => {
      try {
        await persist();
      } catch (error) {
        fail(error);
      }
      setState((current) => (current ? apply(current) : current));
    },
    [fail],
  );

  const requireState = useCallback(() => {
    const current = stateRef.current;
    if (!current) throw new Error("Données pas encore chargées.");
    return current;
  }, []);

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      const { transaction, rule } = buildTransaction(requireState(), input, uuid);
      await commit(
        () => repository.createTransaction(transaction, rule),
        (current) => withTransaction(current, transaction, rule),
      );
      return transaction;
    },
    [commit, repository, requireState],
  );

  const updateTransaction = useCallback(
    async (original: Transaction, input: Omit<NewTransactionInput, "recurrence">) => {
      const updated = editTransaction(requireState(), original, input);
      await commit(
        () => repository.updateTransaction(updated),
        (current) => withEditedTransaction(current, updated),
      );
      return updated;
    },
    [commit, repository, requireState],
  );

  const removeTransaction = useCallback(
    async (transaction: Transaction, options: { withRecurrence?: boolean } = {}) => {
      const ruleId = options.withRecurrence ? transaction.recurrenceId : undefined;
      await commit(
        () => repository.deleteTransaction(transaction, ruleId),
        (current) => withoutTransaction(current, transaction, ruleId),
      );
    },
    [commit, repository],
  );

  const restoreTransaction = useCallback(
    async (transaction: Transaction) => {
      // La règle récurrente a pu être supprimée entre-temps : on ne recrée pas de lien cassé.
      const hasRule = Boolean(transaction.recurrenceId && requireState().recurring.some((r) => r.id === transaction.recurrenceId));
      const restored: Transaction = hasRule ? transaction : { ...transaction, recurrenceId: undefined, recurrence: transaction.recurrenceId ? "none" : transaction.recurrence };
      await commit(
        () => repository.createTransaction(restored),
        (current) => withTransaction(current, restored),
      );
    },
    [commit, repository, requireState],
  );

  const setCategoryBudget = useCallback(
    async (month: string, categoryId: CategoryId, amount: number) => {
      await commit(
        () => repository.setCategoryBudget(month, categoryId, amount),
        (current) => withCategoryBudget(current, month, categoryId, amount),
      );
    },
    [commit, repository],
  );

  const addCategory = useCallback(
    async (input: NewCategoryInput, month?: string) => {
      const current = requireState();
      const category = buildCategory(input, uuid, isDemo);
      const budgetMonth = month ?? monthKey(current.today);
      await commit(
        async () => {
          await repository.createCategory(category);
          if (input.budget > 0) await repository.setCategoryBudget(budgetMonth, category.id, input.budget);
        },
        (next) => {
          const withNew = withCategory(next, category);
          return input.budget > 0 ? withCategoryBudget(withNew, budgetMonth, category.id, input.budget) : withNew;
        },
      );
      return category;
    },
    [commit, repository, isDemo, requireState],
  );

  const updateCategory = useCallback(
    async (id: CategoryId, patch: Partial<Pick<Category, "label" | "emoji" | "tone">>) => {
      const category = { ...findCategory(requireState().categories, id), ...patch };
      await commit(
        () => repository.updateCategory(category),
        (current) => withUpdatedCategory(current, id, patch),
      );
    },
    [commit, repository, requireState],
  );

  const archiveCategory = useCallback(
    async (id: CategoryId) => {
      await commit(
        () => repository.archiveCategory(id),
        (current) => withArchivedCategory(current, id),
      );
    },
    [commit, repository],
  );

  const setMonthTargets = useCallback(
    async (month: string, targets: MonthTargets) => {
      await commit(
        () => repository.setMonthTargets(month, targets),
        (current) => withMonthTargets(current, month, targets),
      );
    },
    [commit, repository],
  );

  const addGoal = useCallback(
    async (input: NewGoalInput) => {
      const goal = buildGoal(input, uuid);
      await commit(
        () => repository.createGoal(goal),
        (current) => withGoal(current, goal),
      );
      return goal;
    },
    [commit, repository],
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<GoalInput>) => {
      const updated = withUpdatedGoal(requireState(), id, patch).goals.find((g) => g.id === id);
      if (!updated) throw new Error("Objectif introuvable.");
      await commit(
        () => repository.updateGoal(updated),
        (current) => withUpdatedGoal(current, id, patch),
      );
    },
    [commit, repository, requireState],
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await commit(
        () => repository.deleteGoal(id),
        (current) => withoutGoal(current, id),
      );
    },
    [commit, repository],
  );

  const updateRecurring = useCallback(
    async (id: string, patch: RecurringPatch) => {
      const current = requireState();
      const rule = current.recurring.find((r) => r.id === id);
      if (!rule) throw new Error("Récurrence introuvable.");
      // Date, fréquence et reprise après une pause rendues cohérentes avant l'enregistrement.
      const resolved = resolveRecurringPatch(rule, patch, current.today);
      await commit(
        () => repository.updateRecurring(id, resolved),
        (latest) => withUpdatedRecurring(latest, id, resolved),
      );
    },
    [commit, repository, requireState],
  );

  const removeRecurring = useCallback(
    async (id: string) => {
      await commit(
        () => repository.deleteRecurring(id),
        (current) => withoutRecurring(current, id),
      );
    },
    [commit, repository],
  );

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      const current = requireState();
      if (!current.profile) return;
      const next = withProfile(current, patch).profile!;
      await commit(
        () => repository.updateProfile(next.id, { displayName: next.displayName, preferences: next.preferences }),
        (latest) => withProfile(latest, patch),
      );
    },
    [commit, repository, requireState],
  );

  const updateAccount = useCallback(
    async (id: AccountId, patch: AccountPatch) => {
      const updated = withUpdatedAccount(requireState(), id, patch).accounts.find((a) => a.id === id);
      if (!updated) throw new Error("Compte introuvable.");
      await commit(
        () => repository.updateAccount(updated),
        (current) => withUpdatedAccount(current, id, patch),
      );
    },
    [commit, repository, requireState],
  );

  const moveAccount = useCallback(
    async (id: AccountId, toIndex: number) => {
      const ids = requireState().accounts.map((a) => a.id);
      const ordered = moveInOrder(ids, id, toIndex);
      if (ordered.every((value, index) => value === ids[index])) return;
      await commit(
        () => repository.reorderAccounts(ordered),
        (current) => withAccountOrder(current, ordered),
      );
    },
    [commit, repository, requireState],
  );

  const resetDemo = useCallback(() => {
    if (isDemo) setState(createDemoState());
  }, [isDemo]);

  const value = useMemo<BudgetContextValue>(() => {
    const raw = state ?? emptyState(isDemo ? appConfig.demoToday : todayInParis());
    const data = deriveBudgetData(raw);
    const currentMonth = monthKey(data.today);
    return {
      ...data,
      source: repository.source,
      status,
      loadError,
      currentMonth,
      summary: getMonthSummary(data, currentMonth),
      allTransactions: raw.transactions,
      reload,
      addTransaction,
      updateTransaction,
      removeTransaction,
      restoreTransaction,
      addCategory,
      updateCategory,
      archiveCategory,
      setCategoryBudget,
      setMonthTargets,
      addGoal,
      updateGoal,
      removeGoal,
      updateRecurring,
      removeRecurring,
      updateProfile,
      updateAccount,
      moveAccount,
      resetDemo,
    };
  }, [
    state,
    isDemo,
    repository.source,
    status,
    loadError,
    reload,
    addTransaction,
    updateTransaction,
    removeTransaction,
    restoreTransaction,
    addCategory,
    updateCategory,
    archiveCategory,
    setCategoryBudget,
    setMonthTargets,
    addGoal,
    updateGoal,
    removeGoal,
    updateRecurring,
    removeRecurring,
    updateProfile,
    updateAccount,
    moveAccount,
    resetDemo,
  ]);

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
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
