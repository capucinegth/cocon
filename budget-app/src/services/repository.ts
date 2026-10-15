/**
 * Accès aux données de Cocon. Les écrans ne parlent jamais directement à Supabase :
 * UI → store (hooks) → dépôt → Supabase → PostgreSQL (protégé par la RLS).
 *
 * Deux implémentations, jamais mélangées :
 *   - démo : données fictives en mémoire, rien n'est envoyé nulle part ;
 *   - Supabase : vraies données de l'utilisateur connecté.
 */
import type { DataSource } from "@/lib/supabase/env";
import type { MonthTargets, RecurringPatch } from "@/store/budget-state";
import type { BudgetState } from "@/types/budget-data";
import type { Account, AccountId, Category, Preferences, RecurringRule, SavingsGoal, Transaction } from "@/types/finance";

export interface BudgetRepository {
  readonly source: DataSource;
  /** Charge toutes les données de l'utilisateur (après génération des récurrences dues). */
  load(today: string): Promise<BudgetState>;

  createTransaction(transaction: Transaction, rule?: RecurringRule): Promise<void>;
  updateTransaction(transaction: Transaction): Promise<void>;
  /** Supprime l'opération, et sa règle récurrente si `ruleId` est fourni (annulation d'un ajout). */
  deleteTransaction(transaction: Transaction, ruleId?: string): Promise<void>;

  createCategory(category: Category): Promise<void>;
  updateCategory(category: Category): Promise<void>;
  archiveCategory(categoryId: string): Promise<void>;
  restoreCategory(categoryId: string): Promise<void>;

  /** Montant prévu pour une catégorie, un mois donné (le budget du mois est créé au besoin). */
  setCategoryBudget(month: string, categoryId: string, amount: number): Promise<void>;
  setMonthTargets(month: string, targets: MonthTargets): Promise<void>;

  createGoal(goal: SavingsGoal): Promise<void>;
  updateGoal(goal: SavingsGoal): Promise<void>;
  deleteGoal(goalId: string): Promise<void>;

  /** Nouvelle règle récurrente seule (charge fixe), sans opération associée. */
  createRecurring(rule: RecurringRule): Promise<void>;
  updateRecurring(ruleId: string, patch: RecurringPatch): Promise<void>;
  deleteRecurring(ruleId: string): Promise<void>;

  /** Nouveau compte, placé à la position donnée (sort_order). */
  createAccount(account: Account, sortOrder: number): Promise<void>;
  /** Nom, solde de départ, actif / désactivé. Un compte n'est jamais supprimé (historique conservé). */
  updateAccount(account: Account): Promise<void>;
  /** Ordre d'affichage des comptes (identifiants dans le nouvel ordre). */
  reorderAccounts(orderedIds: AccountId[]): Promise<void>;

  /** Enregistre le profil complet après modification (nom affiché, préférences). */
  updateProfile(userId: string, profile: { displayName: string; preferences: Preferences }): Promise<void>;
}

export type RepositoryErrorKind = "auth" | "network" | "conflict" | "validation" | "server";

/** Erreur lisible par l'utilisateur (en français), avec sa nature pour réagir au bon endroit. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly kind: RepositoryErrorKind,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export function isSessionError(error: unknown): boolean {
  return error instanceof RepositoryError && error.kind === "auth";
}

export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return error.message;
  return "Une erreur inattendue est survenue. Réessaie dans un instant.";
}
