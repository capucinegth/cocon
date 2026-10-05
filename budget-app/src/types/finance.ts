/**
 * Modèle de données du prototype.
 * Ces types sont pensés pour correspondre plus tard à des tables Supabase
 * (transactions, categories, accounts, budgets, goals…).
 */

/** Familles de couleurs pastel définies dans globals.css. */
export type Tone = "blush" | "lilac" | "sage" | "peach";

/** revenus · charges fixes · dépenses du quotidien · épargne */
export type CategoryGroup = "revenus" | "fixes" | "variables" | "epargne";

/** Identifiant libre : l'utilisateur peut créer ses propres catégories. */
export type CategoryId = string;

export interface Category {
  id: CategoryId;
  label: string;
  /** Libellé court pour les petites tuiles (formulaire d'ajout). */
  shortLabel?: string;
  emoji: string;
  group: CategoryGroup;
  tone: Tone;
}

export type AccountId = "courant" | "joint" | "especes" | "livret";

export interface Account {
  id: AccountId;
  label: string;
  emoji: string;
}

export type TransactionKind = "expense" | "income" | "saving";

export type Recurrence = "none" | "weekly" | "monthly";

export interface Transaction {
  id: string;
  label: string;
  /** Toujours positif : le sens est donné par `kind`. */
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  /** Date ISO AAAA-MM-JJ. */
  date: string;
  note?: string;
  recurrence?: Recurrence;
  /** Objectif alimenté (épargne uniquement). */
  goalId?: string;
}

/** Mouvement prévu mais pas encore passé (prélèvement, course planifiée…). */
export interface UpcomingExpense {
  id: string;
  label: string;
  amount: number;
  categoryId: CategoryId;
  accountId: AccountId;
  date: string;
}

export interface BudgetPlan {
  /** Mois concerné, format AAAA-MM. */
  month: string;
  /** Montant prévu par catégorie (revenus, dépenses et épargne). */
  planned: Record<CategoryId, number>;
}

export interface SavingsGoal {
  id: string;
  label: string;
  emoji: string;
  tone: Tone;
  saved: number;
  target: number;
  /** Versement mensuel prévu vers cet objectif. */
  monthlyContribution: number;
  /** Échéance souhaitée, format AAAA-MM. */
  deadline?: string;
}

/** Mois passés dont on ne garde que les totaux (avant le début des transactions détaillées). */
export interface MonthHistoryPoint {
  /** Format AAAA-MM. */
  month: string;
  expenses: number;
  /** Épargne totale cumulée à la fin du mois. */
  savingsTotal: number;
}
