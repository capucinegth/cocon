/**
 * Conversion base ⇄ application. En base, les montants sont des centimes entiers
 * (aucune erreur d'arrondi) ; à l'écran, des euros à deux décimales.
 */
import { accountTypeEmoji } from "@/config/accounts";
import type {
  Account,
  AccountType,
  BudgetPlan,
  Category,
  CategoryGroup,
  Preferences,
  Profile,
  RecurringRule,
  SavingsGoal,
  Tone,
  Transaction,
  TransactionKind,
} from "@/types/finance";

export function toCents(euros: number): number {
  return Math.round(euros * 100);
}

/** PostgREST renvoie les bigint en nombre (ou en texte selon la configuration). */
export function fromCents(cents: number | string | null | undefined): number {
  return Number(cents ?? 0) / 100;
}

/** « 2026-09 » ⇄ « 2026-09-01 » (premier jour du mois en base). */
export const monthToDate = (month: string) => `${month}-01`;
export const dateToMonth = (date: string) => date.slice(0, 7);

/* ----------------------------------------------------------------- Lignes base */

export interface ProfileRow {
  id: string;
  display_name: string | null;
  preferences: Record<string, unknown> | null;
}
export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  initial_balance_cents: number | string;
  is_active: boolean;
  sort_order: number;
}
export interface CategoryRow {
  id: string;
  name: string;
  type: "fixed" | "variable" | "income" | "saving";
  icon: string;
  color: Tone;
  sort_order: number;
  archived_at: string | null;
}
export interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string;
  goal_id: string | null;
  recurrence_id: string | null;
  type: TransactionKind;
  amount_cents: number | string;
  description: string | null;
  note: string | null;
  transaction_date: string;
}
export interface RecurringRow {
  id: string;
  account_id: string;
  category_id: string;
  goal_id: string | null;
  type: TransactionKind;
  amount_cents: number | string;
  description: string | null;
  frequency: "weekly" | "monthly";
  next_occurrence: string;
  anchor_day: number | null;
  is_active: boolean;
}
export interface GoalRow {
  id: string;
  name: string;
  icon: string;
  color: Tone;
  target_amount_cents: number | string;
  initial_amount_cents: number | string;
  monthly_contribution_cents: number | string;
  target_date: string | null;
  current_amount_cents: number | string;
}
export interface BudgetRow {
  id: string;
  month: string;
  income_target_cents: number | string;
  savings_target_cents: number | string;
  budget_categories: { category_id: string; amount_cents: number | string }[] | null;
}

/* ------------------------------------------------------------------ Catégories */

const groupByType: Record<CategoryRow["type"], CategoryGroup> = {
  fixed: "fixes",
  variable: "variables",
  income: "revenus",
  saving: "epargne",
};
export const typeByGroup: Record<CategoryGroup, CategoryRow["type"]> = {
  fixes: "fixed",
  variables: "variable",
  revenus: "income",
  epargne: "saving",
};

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    label: row.name,
    emoji: row.icon,
    group: groupByType[row.type],
    tone: row.color,
    archived: row.archived_at !== null ? true : undefined,
  };
}

export function categoryToRow(category: Category, sortOrder?: number) {
  return {
    id: category.id,
    name: category.label,
    icon: category.emoji,
    type: typeByGroup[category.group],
    color: category.tone,
    ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
  };
}

/* ---------------------------------------------------------------------- Comptes */

export function accountFromRow(row: AccountRow): Account {
  return {
    id: row.id,
    label: row.name,
    emoji: accountTypeEmoji[row.type] ?? accountTypeEmoji.other,
    type: row.type,
    initialBalance: fromCents(row.initial_balance_cents),
    isActive: row.is_active,
  };
}

/** Champs modifiables d'un compte (jamais `user_id` ni le type : la RLS et la base s'en chargent). */
export function accountToRow(account: Pick<Account, "label" | "initialBalance" | "isActive">) {
  return {
    name: account.label.trim(),
    initial_balance_cents: toCents(account.initialBalance),
    is_active: account.isActive,
  };
}

/* ------------------------------------------------------------------- Opérations */

export function transactionFromRow(row: TransactionRow, rules: Map<string, RecurringRule>, categoryLabel: (id: string) => string): Transaction {
  const rule = row.recurrence_id ? rules.get(row.recurrence_id) : undefined;
  return {
    id: row.id,
    label: row.description?.trim() || categoryLabel(row.category_id),
    amount: fromCents(row.amount_cents),
    kind: row.type,
    categoryId: row.category_id,
    accountId: row.account_id,
    date: row.transaction_date,
    note: row.note ?? undefined,
    recurrence: rule?.frequency ?? "none",
    recurrenceId: row.recurrence_id ?? undefined,
    goalId: row.goal_id ?? undefined,
  };
}

export function transactionToRow(transaction: Transaction) {
  return {
    id: transaction.id,
    account_id: transaction.accountId,
    category_id: transaction.categoryId,
    goal_id: transaction.kind === "saving" ? (transaction.goalId ?? null) : null,
    recurrence_id: transaction.recurrenceId ?? null,
    type: transaction.kind,
    amount_cents: toCents(transaction.amount),
    description: transaction.label,
    note: transaction.note ?? null,
    transaction_date: transaction.date,
  };
}

/* ---------------------------------------------------------------- Récurrences */

export function recurringFromRow(row: RecurringRow, categoryLabel: (id: string) => string): RecurringRule {
  return {
    id: row.id,
    label: row.description?.trim() || categoryLabel(row.category_id),
    amount: fromCents(row.amount_cents),
    kind: row.type,
    categoryId: row.category_id,
    accountId: row.account_id,
    goalId: row.goal_id ?? undefined,
    frequency: row.frequency,
    nextOccurrence: row.next_occurrence,
    anchorDay: row.anchor_day ?? undefined,
    isActive: row.is_active,
  };
}

export function recurringToRow(rule: RecurringRule) {
  return {
    id: rule.id,
    account_id: rule.accountId,
    category_id: rule.categoryId,
    goal_id: rule.kind === "saving" ? (rule.goalId ?? null) : null,
    type: rule.kind,
    amount_cents: toCents(rule.amount),
    description: rule.label,
    frequency: rule.frequency,
    next_occurrence: rule.nextOccurrence,
    anchor_day: rule.frequency === "monthly" ? (rule.anchorDay ?? Number(rule.nextOccurrence.slice(8, 10))) : null,
    is_active: rule.isActive,
  };
}

/* ------------------------------------------------------------------- Objectifs */

export function goalFromRow(row: GoalRow): SavingsGoal {
  return {
    id: row.id,
    label: row.name,
    emoji: row.icon,
    tone: row.color,
    saved: fromCents(row.current_amount_cents),
    initialAmount: fromCents(row.initial_amount_cents),
    target: fromCents(row.target_amount_cents),
    monthlyContribution: fromCents(row.monthly_contribution_cents),
    deadline: row.target_date ? dateToMonth(row.target_date) : undefined,
  };
}

export function goalToRow(goal: SavingsGoal) {
  return {
    id: goal.id,
    name: goal.label,
    icon: goal.emoji,
    color: goal.tone,
    target_amount_cents: toCents(goal.target),
    initial_amount_cents: toCents(goal.initialAmount ?? 0),
    monthly_contribution_cents: toCents(goal.monthlyContribution),
    target_date: goal.deadline ? monthToDate(goal.deadline) : null,
  };
}

/* ---------------------------------------------------------------------- Budgets */

export function planFromRow(row: BudgetRow): BudgetPlan {
  return {
    month: dateToMonth(row.month),
    planned: Object.fromEntries((row.budget_categories ?? []).map((line) => [line.category_id, fromCents(line.amount_cents)])),
    incomeTarget: fromCents(row.income_target_cents),
    savingsTarget: fromCents(row.savings_target_cents),
  };
}

/* ----------------------------------------------------------------------- Profil */

function preferencesFromJson(json: Record<string, unknown> | null): Preferences {
  const value = json ?? {};
  const notifications = (value.notifications ?? {}) as Record<string, unknown>;
  return {
    discreet: typeof value.discreet === "boolean" ? value.discreet : undefined,
    notifications: {
      budgetAlerts: typeof notifications.budgetAlerts === "boolean" ? notifications.budgetAlerts : undefined,
      billReminders: typeof notifications.billReminders === "boolean" ? notifications.billReminders : undefined,
      eveningReminder: typeof notifications.eveningReminder === "boolean" ? notifications.eveningReminder : undefined,
    },
  };
}

export function profileFromRow(row: ProfileRow, email?: string): Profile {
  return { id: row.id, displayName: row.display_name ?? "", email, preferences: preferencesFromJson(row.preferences) };
}
