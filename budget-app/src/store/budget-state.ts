/**
 * État de Cocon : dérivation (passé / à venir / historique) et modifications.
 * Fonctions pures, identiques en démo et avec Supabase — testées dans tests/unit.
 * La base reste la référence : ces transformations reproduisent exactement
 * ce que les écritures en base produisent (pas de second calcul divergent).
 */
import { findCategory } from "@/config/categories";
import { accountTypeEmoji, isLiquidAccount } from "@/config/accounts";
import { accountMovement, preferredAccountId, savingsAccountIds } from "@/lib/accounts";
import { planFor } from "@/lib/budget";
import { addMonths, endOfMonth, monthKey } from "@/lib/dates";
import { roundCents } from "@/lib/format";
import { firstMonthlyDebit, firstOccurrenceFrom, nextOccurrenceDate, projectRecurring } from "@/lib/recurrence";
import { slugify } from "@/lib/text";
import type { BudgetData, BudgetState } from "@/types/budget-data";
import type {
  Account,
  AccountId,
  AccountType,
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
    transferAccountId: t.transferAccountId,
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

/**
 * Solde total hors épargne au 1er de chaque mois : soldes de départ des comptes courants / espèces
 * + opérations enregistrées sur ces comptes (celles du Livret A n'y entrent pas).
 */
export function deriveOpeningBalances(state: BudgetState, months: string[]): Record<string, number> {
  const initial = state.accounts.filter(isLiquidAccount).reduce((acc, account) => acc + account.initialBalance, 0);
  const savings = savingsAccountIds(state.accounts);
  const liquid = state.transactions.filter((t) => !savings.has(t.accountId));
  return Object.fromEntries(
    months.map((month) => {
      const net = liquid.filter((t) => t.date < `${month}-01`).reduce((acc, t) => acc + accountMovement(t), 0);
      return [month, roundCents(initial + net)];
    }),
  );
}

/** Ce que lisent les écrans : opérations passées, mouvements à venir du mois, historique. */
export function deriveBudgetData(state: BudgetState): BudgetData {
  const { today } = state;
  const past = state.transactions.filter((t) => t.date <= today);
  const planned = state.transactions.filter((t) => t.date > today).map(toUpcoming);
  const projected = projectRecurring(state.recurring, state.transactions, today, endOfMonth(today), state.accounts);
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
  /** Épargne : compte d'épargne de destination. */
  transferAccountId?: AccountId;
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
  const transferAccountId = input.kind === "saving" ? input.transferAccountId : undefined;
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
          transferAccountId,
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
    transferAccountId,
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
    transferAccountId: input.kind === "saving" ? input.transferAccountId : undefined,
  };
}

export interface CategoryInput {
  label: string;
  emoji: string;
  /** Dépenses (fixes / quotidien) ou revenus. L'épargne garde sa catégorie unique. */
  group: "fixes" | "variables" | "revenus";
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

/** Restaurer une catégorie archivée : elle redevient proposée pour les nouvelles opérations. */
export function withRestoredCategory(state: BudgetState, id: CategoryId): BudgetState {
  return { ...state, categories: state.categories.map((c) => (c.id === id ? { ...c, archived: undefined } : c)) };
}

const categoryFamily = (category: Category) => (category.group === "revenus" ? "income" : category.group === "epargne" ? "saving" : "expense");

/**
 * On peut archiver une catégorie de dépense ou de revenu, sauf la dernière active de sa famille
 * (sinon plus aucune dépense / aucun revenu ne pourrait être saisi). La catégorie d'épargne reste toujours active.
 */
export function canArchiveCategory(categories: Category[], id: CategoryId): boolean {
  const category = categories.find((c) => c.id === id);
  if (!category || category.archived || category.group === "epargne") return false;
  return categories.some((c) => c.id !== id && !c.archived && categoryFamily(c) === categoryFamily(category));
}

/** Une catégorie active porte déjà ce nom (la base refuse deux catégories actives du même nom). */
export function hasActiveCategoryNamed(categories: Category[], label: string, exceptId?: CategoryId): boolean {
  const name = label.trim().toLocaleLowerCase("fr");
  return categories.some((c) => c.id !== exceptId && !c.archived && c.label.trim().toLocaleLowerCase("fr") === name);
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

export interface FixedChargeInput {
  label: string;
  amount: number;
  categoryId: CategoryId;
  accountId: AccountId;
  /** Jour du prélèvement (1–31 ; « 31 » = dernier jour des mois plus courts). */
  day: number;
}

/**
 * Charge fixe récurrente (loyer, abonnement…) : une règle mensuelle, sans opération créée aujourd'hui.
 * Son premier prélèvement est le prochain jour prévu à partir d'aujourd'hui : un prélèvement de ce mois
 * déjà passé n'est pas déduit du solde actuel (il y est déjà).
 */
export function buildFixedCharge(input: FixedChargeInput, today: string, makeId: () => string): RecurringRule {
  const day = Math.min(Math.max(Math.round(input.day), 1), 31);
  return {
    id: makeId(),
    label: input.label.trim(),
    amount: roundCents(input.amount),
    kind: "expense",
    categoryId: input.categoryId,
    accountId: input.accountId,
    frequency: "monthly",
    anchorDay: day,
    nextOccurrence: firstMonthlyDebit(day, today),
    isActive: true,
  };
}

export function withRecurring(state: BudgetState, rule: RecurringRule): BudgetState {
  return state.recurring.some((r) => r.id === rule.id) ? state : { ...state, recurring: [...state.recurring, rule] };
}

export type RecurringPatch = Partial<
  Pick<RecurringRule, "label" | "amount" | "isActive" | "nextOccurrence" | "frequency" | "anchorDay" | "categoryId" | "accountId" | "transferAccountId">
>;

/**
 * Modification complète et cohérente d'une règle récurrente, à partir de ce que l'utilisateur a changé.
 *   - Mensuel : le jour d'ancrage suit la date choisie (il ne change pas si ni la date ni la fréquence ne changent,
 *     pour qu'un « 31 » reste un « fin de mois »). Hebdomadaire : pas de jour d'ancrage.
 *   - Reprise après une pause, ou date choisie dans le passé : la règle repart de sa première échéance
 *     à partir d'aujourd'hui, sans rattraper les dates passées (aucune opération rétroactive).
 * Les opérations déjà générées ne sont jamais modifiées.
 */
export function resolveRecurringPatch(rule: RecurringRule, patch: RecurringPatch, today: string): RecurringPatch {
  const frequency = patch.frequency ?? rule.frequency;
  const requestedDate = patch.nextOccurrence ?? rule.nextOccurrence;
  const dateChanged = requestedDate !== rule.nextOccurrence;
  const frequencyChanged = frequency !== rule.frequency;
  const dayOf = (date: string) => Number(date.slice(8, 10));

  const anchorDay =
    frequency === "weekly" ? undefined : dateChanged || frequencyChanged || rule.anchorDay === undefined ? dayOf(requestedDate) : rule.anchorDay;
  const resumed = patch.isActive === true && !rule.isActive;
  const nextOccurrence =
    (resumed || dateChanged) && requestedDate < today ? firstOccurrenceFrom({ nextOccurrence: requestedDate, frequency, anchorDay }, today) : requestedDate;

  return { ...patch, frequency, anchorDay, nextOccurrence };
}

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

export type AccountPatch = Partial<Pick<Account, "label" | "initialBalance" | "isActive">>;

/**
 * Modifier un compte. Les opérations ne changent jamais (désactiver un compte le retire seulement des choix).
 * Démo : les soldes d'ouverture figés suivent le nouveau solde de départ.
 */
export function withUpdatedAccount(state: BudgetState, id: AccountId, patch: AccountPatch): BudgetState {
  const account = state.accounts.find((a) => a.id === id);
  if (!account) return state;
  const updated: Account = {
    ...account,
    ...patch,
    label: (patch.label ?? account.label).trim(),
    initialBalance: patch.initialBalance !== undefined ? roundCents(patch.initialBalance) : account.initialBalance,
  };
  const delta = isLiquidAccount(account) ? roundCents(updated.initialBalance - account.initialBalance) : 0;
  const openingBalances =
    state.openingBalances && delta !== 0
      ? Object.fromEntries(Object.entries(state.openingBalances).map(([month, value]) => [month, roundCents(value + delta)]))
      : state.openingBalances;
  return { ...state, accounts: state.accounts.map((a) => (a.id === id ? updated : a)), openingBalances };
}

export interface AccountInput {
  label: string;
  type: AccountType;
  initialBalance: number;
}

/** Nouveau compte (toujours actif à sa création), placé à la fin de la liste. */
export function buildAccount(input: AccountInput, makeId: () => string): Account {
  return {
    id: makeId(),
    label: input.label.trim(),
    emoji: accountTypeEmoji[input.type] ?? accountTypeEmoji.other,
    type: input.type,
    initialBalance: roundCents(input.initialBalance),
    isActive: true,
  };
}

export function withAccount(state: BudgetState, account: Account): BudgetState {
  if (state.accounts.some((a) => a.id === account.id)) return state;
  // Démo : les soldes d'ouverture figés incluent le solde de départ d'un nouveau compte hors épargne.
  const shift = isLiquidAccount(account) ? account.initialBalance : 0;
  const openingBalances =
    state.openingBalances && shift !== 0
      ? Object.fromEntries(Object.entries(state.openingBalances).map(([month, value]) => [month, roundCents(value + shift)]))
      : state.openingBalances;
  return { ...state, accounts: [...state.accounts, account], openingBalances };
}

/** Ordre d'affichage des comptes (identifiants dans le nouvel ordre ; les autres gardent leur place à la fin). */
export function withAccountOrder(state: BudgetState, orderedIds: AccountId[]): BudgetState {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  const accounts = [...state.accounts].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  return { ...state, accounts };
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

/**
 * Règles des comptes d'une opération ou d'une récurrence (message clair, ou null si tout est valide) :
 *   - le compte de l'opération (source d'une épargne) est un compte actif hors épargne ;
 *   - une épargne est un transfert vers un compte d'épargne actif, différent de la source ;
 *   - en modification, les comptes déjà utilisés restent acceptés même s'ils ont été désactivés depuis.
 */
export function accountsProblem(
  accounts: Account[],
  input: { kind: TransactionKind; accountId: AccountId; transferAccountId?: AccountId },
  original?: { accountId: AccountId; transferAccountId?: AccountId },
): string | null {
  const source = accounts.find((a) => a.id === input.accountId);
  if (!source) return "Choisis un compte.";
  if (!isLiquidAccount(source)) {
    return input.kind === "saving"
      ? "L'épargne se verse depuis un compte hors épargne."
      : "Un compte d'épargne ne reçoit que des transferts d'épargne : choisis un autre compte.";
  }
  if (!source.isActive && source.id !== original?.accountId) return `« ${source.label} » est désactivé : choisis un autre compte.`;
  if (input.kind !== "saving") return null;
  if (!input.transferAccountId) return "Choisis le compte d'épargne qui reçoit ce versement.";
  const destination = accounts.find((a) => a.id === input.transferAccountId);
  if (!destination || isLiquidAccount(destination) || destination.id === source.id) return "La destination doit être un compte d'épargne, différent du compte source.";
  if (!destination.isActive && destination.id !== original?.transferAccountId) return `« ${destination.label} » est désactivé : choisis un autre compte d'épargne.`;
  return null;
}

/** Comptes et catégories par défaut, utilisés par le formulaire d'ajout. */
export function defaultAccountId(state: Pick<BudgetState, "accounts">): AccountId {
  return preferredAccountId(state.accounts);
}

export function savingCategoryId(state: Pick<BudgetState, "categories">): CategoryId {
  return state.categories.find((c) => c.group === "epargne" && !c.archived)?.id ?? state.categories.find((c) => c.group === "epargne")?.id ?? "";
}

export function fallbackExpenseCategoryId(state: Pick<BudgetState, "categories">): CategoryId {
  const variables = state.categories.filter((c) => c.group === "variables" && !c.archived);
  return (variables.find((c) => c.label === "Autres") ?? variables.at(-1))?.id ?? "";
}
