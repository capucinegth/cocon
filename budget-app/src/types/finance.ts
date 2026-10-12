/**
 * Modèle de données de l'application (côté interface).
 * Les montants sont en euros (nombres à deux décimales) ; en base ils sont stockés
 * en centimes entiers et convertis par `src/services/mappers.ts`.
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
  /** Catégorie archivée : conservée pour l'historique, masquée des listes. */
  archived?: boolean;
}

export type AccountId = string;

export type AccountType = "checking" | "savings" | "cash" | "joint" | "other";

export interface Account {
  id: AccountId;
  label: string;
  emoji: string;
  type: AccountType;
  /** Solde au moment où le compte a été ajouté. Le solde courant est calculé. */
  initialBalance: number;
  isActive: boolean;
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
  /** Date ISO AAAA-MM-JJ (date calendaire, sans fuseau). */
  date: string;
  note?: string;
  recurrence?: Recurrence;
  /** Règle récurrente qui a créé (ou accompagne) cette opération. */
  recurrenceId?: string;
  /** Objectif alimenté (épargne uniquement). */
  goalId?: string;
  /**
   * Épargne : compte d'épargne de destination (transfert depuis `accountId`).
   * Absent sur les anciennes épargnes : compte de destination non précisé.
   */
  transferAccountId?: AccountId;
}

/**
 * Mouvement à venir dans le mois : opération datée dans le futur (« prévue »)
 * ou prochaine échéance d'une règle récurrente pas encore générée.
 */
export interface UpcomingItem {
  id: string;
  label: string;
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  date: string;
  origin: "planned" | "recurring";
  recurrenceId?: string;
  goalId?: string;
  transferAccountId?: AccountId;
}

/** @deprecated Ancien nom (V2) — utiliser UpcomingItem. */
export type UpcomingExpense = UpcomingItem;

/** Règle d'opération récurrente (loyer, salaire, abonnement…). */
export interface RecurringRule {
  id: string;
  label: string;
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  goalId?: string;
  /** Épargne : compte d'épargne de destination. */
  transferAccountId?: AccountId;
  frequency: Exclude<Recurrence, "none">;
  /** Prochaine date à générer (AAAA-MM-JJ). */
  nextOccurrence: string;
  /** Jour d'origine pour les règles mensuelles (un 31 reste « fin de mois »). */
  anchorDay?: number;
  isActive: boolean;
}

export interface BudgetPlan {
  /** Mois concerné, format AAAA-MM. */
  month: string;
  /** Montant prévu par catégorie de dépense. */
  planned: Record<CategoryId, number>;
  /** Épargne prévue pour le mois. */
  savingsTarget: number;
  /** Revenus attendus pour le mois. */
  incomeTarget: number;
}

export interface SavingsGoal {
  id: string;
  label: string;
  emoji: string;
  tone: Tone;
  /** Montant actuellement épargné (épargne initiale + versements). */
  saved: number;
  /** Épargne initiale, avant le suivi dans Cocon. */
  initialAmount?: number;
  target: number;
  /** Versement mensuel prévu vers cet objectif. */
  monthlyContribution: number;
  /** Échéance souhaitée, format AAAA-MM. */
  deadline?: string;
}

/** Totaux d'un mois (historique résumé ou recalculé à partir des opérations). */
export interface MonthHistoryPoint {
  /** Format AAAA-MM. */
  month: string;
  expenses: number;
  /** Épargne totale cumulée à la fin du mois. */
  savingsTotal: number;
}

export interface Preferences {
  /** Mode discret : montants floutés. */
  discreet?: boolean;
  notifications?: {
    budgetAlerts?: boolean;
    billReminders?: boolean;
    eveningReminder?: boolean;
  };
}

export interface Profile {
  id: string;
  displayName: string;
  email?: string;
  preferences: Preferences;
}
