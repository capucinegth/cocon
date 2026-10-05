/**
 * État de Cocon : dérivation (passé / à venir / historique) et modifications.
 * Fonctions pures, identiques en démo et avec Supabase — testées dans tests/unit.
 * La base reste la référence : ces transformations reproduisent exactement
 * ce que les écritures en base produisent (pas de second calcul divergent).
 */
import { findCategory } from "@/config/categories";
import { isLiquidAccount } from "@/config/accounts";
import { planFor } from "@/lib/budget";
import { addMonths, endOfMonth, monthKey } from "@/lib/dates";
import { roundCents } from "@/lib/format";
import { nextOccurrenceDate, projectRecurring } from "@/lib/recurrence";
import { slugify } from "@/lib/text";
import type { BudgetData, BudgetState } from "@/types/budget-data";
import type {
  AccountId,
  BudgetPlan,
  Category,
  CategoryId,
  MonthHistoryPoint,
  Profile,
  Recurrence,
  RecurringRule,
  SavingsGoal,
  Tone,
  Transaction,
  TransactionKind,
  UpcomingItem,
} from "@/types/finance";

/* ------------------------------------------------------------------ Dérivation */

const HISTORY_MONTHS = 6;

function toUpcoming(t: Transaction): UpcomingItem {
  return {
    id: t.id,
    label: t.label,
    amount: t.amount,
    kind: t.kind,
    categoryId: t.categoryId,
    accountId: t.accountId,
    date: t.date,
    origin: "planned",
    recurrenceId: t.recurrenceId,
    goalId: t.goalId,
  };
}

/** Épargne totale à la fin de chaque mois : épargne initiale des objectifs + versements. */
export function deriveHistory(state: BudgetState, months: string[]): MonthHistoryPoint[] {
  const initial = roundCents(state.goals.reduce((acc, goal) => acc + (goal.initialAmount ?? 0), 0));
  return months.map((month) => {
    const end = endOfMonth(`${month}-01`);
    const saved = state.transactions.filter((t) => t.kind === "saving" && t.date <= end).reduce((acc, t) => acc + t.amount, 0);
    // Les dépenses sont recalculées à partir des opérations par getMonthlyHistory.
    return { month, expenses: 0, savingsTotal: roundCents(initial + saved) };
  });
}

/** Argent disponible (comptes hors épargne) au 1er de chaque mois. */
export function deriveOpeningBalances(state: BudgetState, months: string[]): Record<string, number> {
  const initial = state.accounts.filter(isLiquidAccount).reduce((acc, account) => acc + account.initialBalance, 0);
  return Object.fromEntries(
    months.map((month) => {
      const net = state.transactions
        .filter((t) => t.date < `${month}-01`)
        .reduce((acc, t) => acc + (t.kind === "income" ? t.amount : -t.amount), 0);
      return [month, roundCents(initial + net)];
    }),
  );
}

/** Ce que lisent les écrans : opérations passées, mouvements à venir du mois, historique. */
export function deriveBudgetData(state: BudgetState): BudgetData {
  const { today } = state;
  const past = state.transactions.filter((t) => t.date <= today);
  const planned = state.transactions.filter((t) => t.date > today).map(toUpcoming);
  const projected = projectRecurring(state.recurring, state.transactions, today, endOfMonth(today));
  const upcoming = [...planned, ...projected].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const current = monthKey(today);
  const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => addMonths(current, i - (HISTORY_MONTHS - 1)));

  return {
    today,
    categories: state.categories,
    accounts: state.accounts,
    transactions: past,
    upcoming,
    recurring: state.recurring,
    plans: state.plans,
    goals: state.goals,
    history: state.history ?? deriveHistory(state, months),
    openingBalances: state.openingBalances ?? deriveOpeningBalances(state, months),
    profile: state.profile,
  };
}

/* ------------------------------------------------------------ Construction */

export interface TransactionInput {
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  date: string;
  label?: string;
  note?: string;
  recurrence: Recurrence;
  goalId?: string;
}

/** Libellé par défaut : l'objectif (épargne) ou la catégorie. */
export function defaultLabel(state: Pick<BudgetState, "categories" | "goals">, input: Pick<TransactionInput, "goalId" | "categoryId">): string {
  if (input.goalId) return state.goals.find((g) => g.id === input.goalId)?.label ?? "Épargne";
  return findCategory(state.categories, input.categoryId).label;
}

/**
 * Prépare une opération (et sa règle, si elle se répète). La règle commence à
 * l'échéance suivante : l'opération saisie est la première occurrence.
 */
export function buildTransaction(
  state: Pick<BudgetState, "categories" | "goals">,
  input: TransactionInput,
  makeId: () => string,
): { transaction: Transaction; rule?: RecurringRule } {
  const label = input.label?.trim() || defaultLabel(state, input);
  const goalId = input.kind === "saving" ? input.goalId : undefined;
  const rule: RecurringRule | undefined =
    input.recurrence === "none"
      ? undefined
      : {
          id: makeId(),
          label,
          amount: roundCents(input.amount),
          kind: input.kind,
          categoryId: input.categoryId,
          accountId: input.accountId,
          goalId,
          frequency: input.recurrence,
          anchorDay: input.recurrence === "monthly" ? Number(input.date.slice(8, 10)) : undefined,
          nextOccurrence: nextOccurrenceDate(input.date, input.recurrence, Number(input.date.slice(8, 10))),
          isActive: true,
        };
  const transaction: Transaction = {
    id: makeId(),
    label,
    amount: roundCents(input.amount),
    kind: input.kind,
    categoryId: input.categoryId,
    accountId: input.accountId,
    date: input.date,
    note: input.note?.trim() || undefined,
    recurrence: input.recurrence,
    recurrenceId: rule?.id,
    goalId,
  };
  return { transaction, rule };
}

/** Modification d'une opération existante (la récurrence éventuelle n'est pas modifiée). */
export function editTransaction(state: Pick<BudgetState, "categories" | "goals">, original: Transaction, input: Omit<TransactionInput, "recurrence">): Transaction {
  return {
    ...original,
    label: input.label?.trim() || defaultLabel(state, input),
    amount: roundCents(input.amount),
    kind: input.kind,
    categoryId: input.categoryId,
    accountId: input.accountId,
    date: input.date,
    note: input.note?.trim() || undefined,
    goalId: input.kind === "saving" ? input.goalId : undefined,
  };
}

export interface CategoryInput {
  label: string;
  emoji: string;
  group: "fixes" | "variables";
  tone: Tone;
}

export function buildCategory(input: CategoryInput, makeId: () => string, demo: boolean): Category {
  return {
    id: demo ? `${slugify(input.label) || "categorie"}-${makeId().slice(0, 6)}` : makeId(),
    label: input.label.trim(),
    emoji: input.emoji,
    group: input.group,
    tone: input.tone,
  };
}

/* ------------------------------------------------------------- Modifications */

/** Une opération d'épargne passée et liée à un objectif fait avancer cet objectif. */
function applyToGoals(goals: SavingsGoal[], transaction: Transaction, today: string, direction: 1 | -1): SavingsGoal[] {
  if (transaction.kind !== "saving" || !transaction.goalId || transaction.date > today) return goals;
  return goals.map((goal) =>
    goal.id === transaction.goalId ? { ...goal, saved: Math.max(roundCents(goal.saved + direction * transaction.amount), 0) } : goal,
  );
}

export function withTransaction(state: BudgetState, transaction: Transaction, rule?: RecurringRule): BudgetState {
  if (state.transactions.some((t) => t.id === transaction.id)) return state;
  return {
    ...state,
    transactions: [transaction, ...state.transactions],
    recurring: rule && !state.recurring.some((r) => r.id === rule.id) ? [...state.recurring, rule] : state.recurring,
    goals: applyToGoals(state.goals, transaction, state.today, 1),
  };
}

export function withoutTransaction(state: BudgetState, transaction: Transaction, ruleId?: string): BudgetState {
  if (!state.transactions.some((t) => t.id === transaction.id)) return state;
  const stored = state.transactions.find((t) => t.id === transaction.id)!;
  const next = {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== transaction.id),
    goals: applyToGoals(state.goals, stored, state.today, -1),
  };
  return ruleId ? withoutRecurring(next, ruleId) : next;
}

export function withEditedTransaction(state: BudgetState, updated: Transaction): BudgetState {
  const original = state.transactions.find((t) => t.id === updated.id);
  if (!original) return state;
  const goals = applyToGoals(applyToGoals(state.goals, original, state.today, -1), updated, state.today, 1);
  return { ...state, transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)), goals };
}

/** Ordre d'affichage : dépenses (« Autres » en dernier), puis revenus, puis épargne. */
function groupOrder(category: Category): number {
  if (category.group === "revenus") return 3;
  if (category.group === "epargne") return 4;
  return category.label === "Autres" ? 2 : 1;
}

/** Tri stable : dépenses dans l'ordre d'origine, « Autres » en dernier, puis revenus et épargne. */
export function sortCategories(categories: Category[]): Category[] {
  return categories
    .map((c, i) => ({ c, i }))
    .sort((a, b) => groupOrder(a.c) - groupOrder(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

export function withCategory(state: BudgetState, category: Category): BudgetState {
  return { ...state, categories: sortCategories([...state.categories, category]) };
}

export function withUpdatedCategory(state: BudgetState, id: CategoryId, patch: Partial<Pick<Category, "label" | "emoji" | "tone">>): BudgetState {
  return { ...state, categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

/** Archiver : la catégorie disparaît des listes mais l'historique est conservé. */
export function withArchivedCategory(state: BudgetState, id: CategoryId): BudgetState {
  return { ...state, categories: state.categories.map((c) => (c.id === id ? { ...c, archived: true } : c)) };
}

/** Budget d'un mois : celui du mois, ou une copie du précédent (comme `ensure_month_budget`). */
function monthPlan(state: BudgetState, month: string): BudgetPlan {
  const plan = planFor(state, month);
  if (plan) {
    const { inherited: _inherited, ...rest } = plan;
    void _inherited;
    return { ...rest, month, planned: { ...rest.planned } };
  }
  return { month, planned: {}, savingsTarget: 0, incomeTarget: 0 };
}

function withPlan(state: BudgetState, plan: BudgetPlan): BudgetState {
  const others = state.plans.filter((p) => p.month !== plan.month);
  return { ...state, plans: [...others, plan].sort((a, b) => a.month.localeCompare(b.month)) };
}

export function withCategoryBudget(state: BudgetState, month: string, categoryId: CategoryId, amount: number): BudgetState {
  const plan = monthPlan(state, month);
  return withPlan(state, { ...plan, planned: { ...plan.planned, [categoryId]: roundCents(amount) } });
}

export interface MonthTargets {
  incomeTarget?: number;
  savingsTarget?: number;
}

export function withMonthTargets(state: BudgetState, month: string, targets: MonthTargets): BudgetState {
  const plan = monthPlan(state, month);
  return withPlan(state, {
    ...plan,
    incomeTarget: targets.incomeTarget !== undefined ? roundCents(targets.incomeTarget) : plan.incomeTarget,
    savingsTarget: targets.savingsTarget !== undefined ? roundCents(targets.savingsTarget) : plan.savingsTarget,
  });
}

export type GoalInput = Omit<SavingsGoal, "id" | "saved"> & { initialAmount: number };

export function buildGoal(input: GoalInput, makeId: () => string): SavingsGoal {
  const initialAmount = roundCents(Math.max(input.initialAmount, 0));
  return { ...input, id: makeId(), label: input.label.trim(), initialAmount, saved: initialAmount };
}

export function withGoal(state: BudgetState, goal: SavingsGoal): BudgetState {
  return state.goals.some((g) => g.id === goal.id) ? state : { ...state, goals: [...state.goals, goal] };
}

/** Modifier l'épargne initiale décale d'autant le montant épargné. */
export function withUpdatedGoal(state: BudgetState, id: string, patch: Partial<GoalInput>): BudgetState {
  return {
    ...state,
    goals: state.goals.map((goal) => {
      if (goal.id !== id) return goal;
      const previousInitial = goal.initialAmount ?? 0;
      const initialAmount = patch.initialAmount !== undefined ? roundCents(Math.max(patch.initialAmount, 0)) : previousInitial;
      return {
        ...goal,
        ...patch,
        label: (patch.label ?? goal.label).trim(),
        initialAmount,
        saved: Math.max(roundCents(goal.saved + initialAmount - previousInitial), 0),
      };
    }),
  };
}

/** Supprimer un objectif conserve les versements (ils deviennent de l'épargne « libre »). */
export function withoutGoal(state: BudgetState, id: string): BudgetState {
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== id),
    transactions: state.transactions.map((t) => (t.goalId === id ? { ...t, goalId: undefined } : t)),
    recurring: state.recurring.map((r) => (r.goalId === id ? { ...r, goalId: undefined } : r)),
  };
}

export type RecurringPatch = Partial<Pick<RecurringRule, "label" | "amount" | "isActive" | "nextOccurrence">>;

export function withUpdatedRecurring(state: BudgetState, id: string, patch: RecurringPatch): BudgetState {
  return {
    ...state,
    recurring: state.recurring.map((rule) =>
      rule.id === id ? { ...rule, ...patch, amount: patch.amount !== undefined ? roundCents(patch.amount) : rule.amount } : rule,
    ),
  };
}

/** Supprimer une récurrence garde les opérations déjà passées (elles ne se répètent plus). */
export function withoutRecurring(state: BudgetState, id: string): BudgetState {
  return {
    ...state,
    recurring: state.recurring.filter((r) => r.id !== id),
    transactions: state.transactions.map((t) => (t.recurrenceId === id ? { ...t, recurrenceId: undefined, recurrence: "none" } : t)),
  };
}

export type ProfilePatch = Partial<Pick<Profile, "displayName" | "preferences">>;

export function withProfile(state: BudgetState, patch: ProfilePatch): BudgetState {
  if (!state.profile) return state;
  return {
    ...state,
    profile: {
      ...state.profile,
      ...patch,
      displayName: patch.displayName !== undefined ? patch.displayName.trim() : state.profile.displayName,
      preferences: { ...state.profile.preferences, ...patch.preferences },
    },
  };
}

/** Comptes et catégories par défaut, utilisés par le formulaire d'ajout. */
export function defaultAccountId(state: Pick<BudgetState, "accounts">): AccountId {
  return (state.accounts.find((a) => a.isActive && a.type === "checking") ?? state.accounts.find((a) => a.isActive))?.id ?? "";
}

export function savingCategoryId(state: Pick<BudgetState, "categories">): CategoryId {
  return state.categories.find((c) => c.group === "epargne" && !c.archived)?.id ?? state.categories.find((c) => c.group === "epargne")?.id ?? "";
}

export function fallbackExpenseCategoryId(state: Pick<BudgetState, "categories">): CategoryId {
  const variables = state.categories.filter((c) => c.group === "variables" && !c.archived);
  return (variables.find((c) => c.label === "Autres") ?? variables.at(-1))?.id ?? "";
}
