import type {
  Account,
  BudgetPlan,
  Category,
  MonthHistoryPoint,
  Profile,
  RecurringRule,
  SavingsGoal,
  Transaction,
  UpcomingItem,
} from "./finance";

/**
 * Tout ce dont les écrans ont besoin, quelle que soit la source (démo ou Supabase).
 * Les écrans ne lisent que cette structure ; les calculs se font dans `src/lib`.
 */
export interface BudgetData {
  /** Date du jour (AAAA-MM-JJ), en heure de Paris. */
  today: string;
  categories: Category[];
  accounts: Account[];
  /** Opérations passées (date ≤ aujourd'hui). */
  transactions: Transaction[];
  /** Opérations à venir : datées dans le futur ou prochaines échéances récurrentes. */
  upcoming: UpcomingItem[];
  recurring: RecurringRule[];
  /** Budgets mensuels (un par mois au plus). */
  plans: BudgetPlan[];
  goals: SavingsGoal[];
  /** Totaux mensuels (6 derniers mois). */
  history: MonthHistoryPoint[];
  /** Solde disponible au 1er de chaque mois (comptes hors épargne). */
  openingBalances: Record<string, number>;
  profile: Profile | null;
}

/**
 * État brut, tel que chargé depuis la source de données.
 * `BudgetData` en est dérivé (opérations passées / à venir, historique…).
 */
export interface BudgetState {
  today: string;
  categories: Category[];
  accounts: Account[];
  /** Toutes les opérations, y compris celles datées dans le futur. */
  transactions: Transaction[];
  recurring: RecurringRule[];
  plans: BudgetPlan[];
  goals: SavingsGoal[];
  /** Historique figé (démo). `null` : recalculé à partir des opérations. */
  history: MonthHistoryPoint[] | null;
  /** Soldes d'ouverture figés (démo). `null` : recalculés à partir des comptes et opérations. */
  openingBalances: Record<string, number> | null;
  profile: Profile | null;
}
