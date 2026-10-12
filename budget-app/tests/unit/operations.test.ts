/** Opérations (note), récurrences (modification complète), catégories, mois futurs et statistiques par mois. */
import { describe, expect, it } from "vitest";
import { compareWithPreviousMonth, withPlannedMonths } from "@/lib/budget";
import { materializeRecurring } from "@/lib/recurrence";
import { transactionsToCsv } from "@/lib/export";
import { categoryToRow, transactionToRow } from "@/services/mappers";
import { createSupabaseRepository } from "@/services/supabase-repository";
import {
  buildCategory,
  buildTransaction,
  canArchiveCategory,
  deriveBudgetData,
  editTransaction,
  hasActiveCategoryNamed,
  resolveRecurringPatch,
  withArchivedCategory,
  withRestoredCategory,
  withUpdatedRecurring,
} from "@/store/budget-state";
import type { RecurringRule } from "@/types/finance";
import { fakeClient } from "./fake-supabase";
import { makeData, makeState, tx } from "./fixtures";

let n = 0;
const id = () => `id${++n}`;

describe("note d'une opération", () => {
  const state = makeState();
  const input = { amount: 12.5, kind: "expense" as const, categoryId: "courses", accountId: "courant", date: "2026-09-12", recurrence: "none" as const };

  it("saisie à l'ajout, sans espaces superflus, envoyée à la base", () => {
    const { transaction } = buildTransaction(state, { ...input, note: "  ticket dans le tiroir " }, id);
    expect(transaction.note).toBe("ticket dans le tiroir");
    expect(transactionToRow(transaction).note).toBe("ticket dans le tiroir");
  });

  it("modifiée, puis effacée en vidant le champ (null en base)", () => {
    const { transaction } = buildTransaction(state, { ...input, note: "première" }, id);
    const edited = editTransaction(state, transaction, { ...input, note: "seconde" });
    expect(edited.note).toBe("seconde");
    const cleared = editTransaction(state, edited, { ...input, note: "   " });
    expect(cleared.note).toBeUndefined();
    expect(transactionToRow(cleared).note).toBeNull();
  });

  it("conservée dans l'export CSV", () => {
    const { transaction } = buildTransaction(state, { ...input, note: "pour Léa" }, id);
    expect(transactionsToCsv([transaction], state).split("\r\n")[1]).toMatch(/;pour Léa$/);
  });
});

const rule = (partial: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "loyer",
  label: "Loyer",
  amount: 650,
  kind: "expense",
  categoryId: "logement",
  accountId: "courant",
  frequency: "monthly",
  nextOccurrence: "2026-10-31",
  anchorDay: 31,
  isActive: true,
  ...partial,
});

describe("modifier une récurrence", () => {
  it("nouvelle date : le jour d'ancrage suit la date choisie", () => {
    const patch = resolveRecurringPatch(rule(), { nextOccurrence: "2026-10-05" }, "2026-09-13");
    expect(patch).toMatchObject({ nextOccurrence: "2026-10-05", anchorDay: 5, frequency: "monthly" });
  });

  it("sans changer la date : un « 31 » reste un « fin de mois »", () => {
    const patch = resolveRecurringPatch(rule({ nextOccurrence: "2026-09-30" }), { amount: 700 }, "2026-09-13");
    expect(patch).toMatchObject({ nextOccurrence: "2026-09-30", anchorDay: 31, amount: 700 });
  });

  it("passer en hebdomadaire supprime le jour d'ancrage ; repasser en mensuel le recalcule", () => {
    const weekly = resolveRecurringPatch(rule(), { frequency: "weekly" }, "2026-09-13");
    expect(weekly.anchorDay).toBeUndefined();
    expect(weekly.nextOccurrence).toBe("2026-10-31");
    const monthly = resolveRecurringPatch(rule({ frequency: "weekly", anchorDay: undefined, nextOccurrence: "2026-09-17" }), { frequency: "monthly" }, "2026-09-13");
    expect(monthly.anchorDay).toBe(17);
  });

  it("une date choisie dans le passé n'entraîne aucune opération rétroactive", () => {
    const patch = resolveRecurringPatch(rule(), { nextOccurrence: "2026-06-15" }, "2026-09-13");
    expect(patch.nextOccurrence).toBe("2026-09-15");
  });

  it("catégorie, compte, fréquence : appliqués aux prochaines échéances, l'historique ne change pas", () => {
    const past = tx("2026-09-01", 650, "expense", "logement", { recurrenceId: "loyer", recurrence: "monthly" });
    const state = makeState({ recurring: [rule({ nextOccurrence: "2026-09-20", anchorDay: 20 })], transactions: [past] });
    const patch = resolveRecurringPatch(state.recurring[0], { categoryId: "abonnements", accountId: "especes", frequency: "weekly", amount: 10 }, state.today);
    const data = deriveBudgetData(withUpdatedRecurring(state, "loyer", patch));
    expect(data.transactions.find((t) => t.id === past.id)).toEqual(past);
    const upcoming = data.upcoming.filter((u) => u.recurrenceId === "loyer");
    expect(upcoming.map((u) => u.date)).toEqual(["2026-09-20", "2026-09-27"]);
    expect(upcoming[0]).toMatchObject({ categoryId: "abonnements", accountId: "especes", amount: 10 });
  });

  it("aucun doublon : une date déjà générée ne l'est pas une seconde fois", () => {
    const existing = tx("2026-09-20", 650, "expense", "logement", { recurrenceId: "loyer" });
    const moved = { ...rule(), ...resolveRecurringPatch(rule(), { nextOccurrence: "2026-09-20" }, "2026-09-13") } as RecurringRule;
    const result = materializeRecurring([moved], [existing], "2026-10-25", id);
    expect(result.created.map((t) => t.date)).toEqual(["2026-10-20"]);
  });

  it("enregistrement Supabase : tous les champs modifiables, jamais user_id", async () => {
    const { client, calls } = fakeClient();
    const patch = resolveRecurringPatch(rule(), { frequency: "weekly", categoryId: "abonnements", accountId: "especes", label: "Box" }, "2026-09-13");
    await createSupabaseRepository(client).updateRecurring("loyer", patch);
    expect(calls).toEqual([
      {
        table: "recurring_transactions",
        values: { description: "Box", next_occurrence: "2026-10-31", frequency: "weekly", anchor_day: null, category_id: "abonnements", account_id: "especes" },
        filters: [["id", "loyer"]],
      },
    ]);
  });
});

describe("catégories", () => {
  it("catégorie de revenu : créée avec le bon type en base", () => {
    const category = buildCategory({ label: "Allocations", emoji: "💶", group: "revenus", tone: "sage" }, id, false);
    expect(categoryToRow(category).type).toBe("income");
  });

  it("archiver puis restaurer : de nouveau proposée, historique intact", () => {
    const state = makeState({ transactions: [tx("2026-09-05", 40, "expense", "loisirs")] });
    const archived = withArchivedCategory(state, "loisirs");
    expect(archived.categories.find((c) => c.id === "loisirs")?.archived).toBe(true);
    const restored = withRestoredCategory(archived, "loisirs");
    expect(restored.categories.find((c) => c.id === "loisirs")?.archived).toBeUndefined();
    expect(restored.transactions).toEqual(state.transactions);
  });

  it("jamais la dernière catégorie active de son type, jamais l'épargne", () => {
    const { categories } = makeState();
    expect(canArchiveCategory(categories, "salaire")).toBe(true);
    const lastIncome = categories.map((c) => (c.group === "revenus" && c.id !== "salaire" ? { ...c, archived: true } : c));
    expect(canArchiveCategory(lastIncome, "salaire")).toBe(false);
    expect(canArchiveCategory(categories, "epargne")).toBe(false);
  });

  it("restauration impossible si une catégorie active porte déjà ce nom", () => {
    const categories = [
      ...makeState().categories.map((c) => (c.id === "loisirs" ? { ...c, archived: true } : c)),
      { id: "loisirs-2", label: "loisirs ", emoji: "🎟️", group: "variables" as const, tone: "blush" as const },
    ];
    expect(hasActiveCategoryNamed(categories, "Loisirs", "loisirs")).toBe(true);
    expect(hasActiveCategoryNamed(categories, "Courses", "courses")).toBe(false);
  });

  it("enregistrement Supabase de la restauration", async () => {
    const { client, calls } = fakeClient();
    await createSupabaseRepository(client).restoreCategory("loisirs");
    expect(calls).toEqual([{ table: "categories", values: { archived_at: null }, filters: [["id", "loisirs"]] }]);
  });
});

describe("mois futurs et statistiques par mois", () => {
  it("les mois futurs qui ont des opérations prévues sont consultables", () => {
    const months = withPlannedMonths(["2026-08", "2026-09"], [tx("2026-11-02", 30, "expense", "loisirs"), tx("2026-09-20", 5, "expense", "courses")], "2026-09-13");
    expect(months).toEqual(["2026-08", "2026-09", "2026-11"]);
  });

  it("une opération future apparaît dans « à venir » de son mois", () => {
    const data = makeData({ transactions: [tx("2026-11-02", 30, "expense", "loisirs")] });
    expect(data.upcoming.filter((u) => u.date.startsWith("2026-11"))).toHaveLength(1);
  });

  it("mois terminé : comparé au mois précédent sur le mois entier", () => {
    const data = makeData({
      transactions: [
        tx("2026-07-31", 100, "expense", "courses"),
        tx("2026-07-10", 50, "expense", "courses"),
        tx("2026-08-30", 120, "expense", "courses"),
        tx("2026-09-05", 10, "expense", "courses"),
      ],
    });
    const august = compareWithPreviousMonth(data, "2026-08");
    expect(august).toMatchObject({ month: "2026-08", previousMonth: "2026-07", full: true, current: 120, previous: 150 });
    const current = compareWithPreviousMonth(data);
    expect(current).toMatchObject({ month: "2026-09", full: false, day: 13, current: 10 });
    expect(compareWithPreviousMonth(data, "2026-07")).toBeNull();
  });
});
