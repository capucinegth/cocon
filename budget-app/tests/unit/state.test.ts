/**
 * Modifications de l'état : ce que l'écran affiche après chaque action doit
 * correspondre à ce que la base calcule (objectifs, budgets, récurrences…).
 */
import { describe, expect, it } from "vitest";
import { getGoalProgress } from "@/lib/goals";
import { getMonthSummary } from "@/lib/budget";
import {
  buildGoal,
  buildTransaction,
  deriveBudgetData,
  withCategoryBudget,
  withMonthTargets,
  withoutGoal,
  withoutRecurring,
  withoutTransaction,
  withTransaction,
  withUpdatedGoal,
  withEditedTransaction,
  editTransaction,
} from "@/store/budget-state";
import { makeState, tx } from "./fixtures";

let n = 0;
const id = () => `id${++n}`;

const goalInput = { label: "Vacances", emoji: "🌴", tone: "lilac" as const, target: 1000, initialAmount: 0, monthlyContribution: 100 };

describe("objectifs", () => {
  it("0 % à la création, puis un versement fait avancer l'objectif", () => {
    const goal = buildGoal(goalInput, id);
    let state = makeState({ goals: [goal] });
    expect(getGoalProgress(state.goals[0], state.today).ratio).toBe(0);
    const { transaction } = buildTransaction(state, { amount: 250, kind: "saving", categoryId: "epargne", accountId: "courant", date: "2026-09-13", recurrence: "none", goalId: goal.id }, id);
    state = withTransaction(state, transaction);
    expect(state.goals[0].saved).toBe(250);
    expect(getGoalProgress(state.goals[0], state.today).ratio).toBe(0.25);
    state = withoutTransaction(state, transaction);
    expect(state.goals[0].saved).toBe(0);
  });

  it("100 % : atteint, plus rien à verser (même si l'on dépasse la cible)", () => {
    const goal = { ...buildGoal({ ...goalInput, initialAmount: 1200 }, id) };
    const progress = getGoalProgress(goal, "2026-09-13");
    expect(progress).toMatchObject({ ratio: 1, remaining: 0, pace: "done" });
  });

  it("un versement daté dans le futur ne compte pas encore", () => {
    const goal = buildGoal(goalInput, id);
    const { transaction } = buildTransaction(makeState({ goals: [goal] }), { amount: 100, kind: "saving", categoryId: "epargne", accountId: "courant", date: "2026-09-20", recurrence: "none", goalId: goal.id }, id);
    expect(withTransaction(makeState({ goals: [goal] }), transaction).goals[0].saved).toBe(0);
  });

  it("modifier l'épargne initiale décale le montant épargné", () => {
    const goal = { ...buildGoal({ ...goalInput, initialAmount: 200 }, id), saved: 450 };
    const state = withUpdatedGoal(makeState({ goals: [goal] }), goal.id, { initialAmount: 300, target: 2000 });
    expect(state.goals[0]).toMatchObject({ saved: 550, initialAmount: 300, target: 2000 });
  });

  it("supprimer un objectif garde les versements, en épargne libre", () => {
    const goal = buildGoal(goalInput, id);
    const saving = tx("2026-09-10", 50, "saving", "epargne", { goalId: goal.id });
    const state = withoutGoal(makeState({ goals: [goal], transactions: [saving] }), goal.id);
    expect(state.goals).toHaveLength(0);
    expect(state.transactions[0]).toMatchObject({ amount: 50, goalId: undefined });
  });
});

describe("opérations et récurrences", () => {
  it("une opération « chaque semaine » crée une règle et ses prochaines échéances du mois", () => {
    let state = makeState();
    const { transaction, rule } = buildTransaction(state, { amount: 12.5, kind: "expense", categoryId: "courses", accountId: "courant", date: "2026-09-13", recurrence: "weekly" }, id);
    expect(rule).toMatchObject({ frequency: "weekly", nextOccurrence: "2026-09-20" });
    expect(transaction.recurrenceId).toBe(rule!.id);
    state = withTransaction(state, transaction, rule);
    const data = deriveBudgetData(state);
    expect(data.upcoming.map((u) => u.date)).toEqual(["2026-09-20", "2026-09-27"]);
    expect(getMonthSummary(data, "2026-09").variable).toBe(37.5);
    // Annuler l'ajout retire aussi la règle.
    expect(withoutTransaction(state, transaction, rule!.id).recurring).toHaveLength(0);
  });

  it("le libellé par défaut est celui de la catégorie", () => {
    const { transaction } = buildTransaction(makeState(), { amount: 5, kind: "expense", categoryId: "transport", accountId: "courant", date: "2026-09-13", recurrence: "none", label: "  " }, id);
    expect(transaction.label).toBe("Transport");
  });

  it("modifier une opération met à jour le résumé", () => {
    const expense = tx("2026-09-05", 40, "expense", "courses");
    let state = makeState({ transactions: [expense] });
    const updated = editTransaction(state, expense, { amount: 55.5, kind: "expense", categoryId: "restaurants", accountId: "courant", date: "2026-09-06", label: "Resto" });
    state = withEditedTransaction(state, updated);
    expect(state.transactions[0]).toMatchObject({ amount: 55.5, categoryId: "restaurants", label: "Resto", date: "2026-09-06" });
  });

  it("supprimer une récurrence garde les opérations passées, sans lien", () => {
    const past = tx("2026-09-01", 650, "expense", "logement", { recurrenceId: "r1", recurrence: "monthly" });
    const state = withoutRecurring(makeState({ transactions: [past], recurring: [] }), "r1");
    expect(state.transactions[0]).toMatchObject({ recurrenceId: undefined, recurrence: "none" });
  });
});

describe("budgets mensuels", () => {
  it("modifier une catégorie d'un nouveau mois part du budget précédent", () => {
    let state = makeState({ plans: [{ month: "2026-09", planned: { courses: 300, loisirs: 80 }, incomeTarget: 2000, savingsTarget: 200 }] });
    state = withCategoryBudget(state, "2026-10", "courses", 350);
    const october = state.plans.find((p) => p.month === "2026-10");
    expect(october).toEqual({ month: "2026-10", planned: { courses: 350, loisirs: 80 }, incomeTarget: 2000, savingsTarget: 200 });
    expect(state.plans.find((p) => p.month === "2026-09")?.planned.courses).toBe(300);
  });

  it("revenus et épargne prévus du mois", () => {
    const state = withMonthTargets(makeState(), "2026-09", { incomeTarget: 1800, savingsTarget: 150 });
    const s = getMonthSummary(deriveBudgetData(state), "2026-09");
    expect(s.income).toBe(1800);
    expect(s.savingsReserved).toBe(150);
    expect(s.remaining).toBe(1650);
  });
});

describe("historique et soldes recalculés (comptes réels)", () => {
  it("épargne cumulée et solde d'ouverture à partir des opérations", () => {
    const goal = { ...buildGoal({ ...goalInput, initialAmount: 500 }, id) };
    const data = deriveBudgetData(
      makeState({
        goals: [goal],
        accounts: [{ id: "courant", label: "Compte courant", emoji: "🏦", type: "checking", initialBalance: 100, isActive: true }],
        transactions: [
          tx("2026-08-01", 1000, "income", "salaire"),
          tx("2026-08-02", 300, "expense", "courses"),
          tx("2026-08-03", 200, "saving", "epargne"),
          tx("2026-09-02", 50, "saving", "epargne"),
        ],
      }),
    );
    expect(data.history.map((h) => h.month)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(data.history.find((h) => h.month === "2026-08")?.savingsTotal).toBe(700);
    expect(data.history.at(-1)?.savingsTotal).toBe(750);
    expect(data.openingBalances["2026-09"]).toBe(600);
    expect(data.openingBalances["2026-08"]).toBe(100);
  });
});
