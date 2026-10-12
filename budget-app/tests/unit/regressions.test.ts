/**
 * Tests de régression des bugs corrigés après l'audit :
 *   1. récurrence réactivée après une pause ;
 *   2. moyenne des tendances ;
 *   3. catégorie archivée dans le budget du quotidien ;
 *   5. saisie des montants (objectifs d'épargne).
 */
import { describe, expect, it } from "vitest";
import { getMonthSummary } from "@/lib/budget";
import { parseAmountInput, sanitizeAmount } from "@/lib/format";
import { firstOccurrenceFrom, materializeRecurring } from "@/lib/recurrence";
import { averagedMonthsCount, averageMonthlyExpenses, getMonthlyHistory } from "@/lib/timeline";
import { deriveBudgetData, resolveRecurringPatch, withArchivedCategory, withUpdatedRecurring } from "@/store/budget-state";
import type { RecurringRule } from "@/types/finance";
import { makeData, makeState, tx } from "./fixtures";

const rule = (partial: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r1",
  label: "Netflix",
  amount: 13.49,
  kind: "expense",
  categoryId: "abonnements",
  accountId: "courant",
  frequency: "monthly",
  nextOccurrence: "2026-02-05",
  anchorDay: 5,
  isActive: false,
  ...partial,
});

let n = 0;
const id = () => `g${++n}`;

describe("bug 1 — récurrence réactivée après une pause", () => {
  it("repart de la prochaine échéance, sans rattraper les mois de pause", () => {
    const paused = rule();
    const patch = resolveRecurringPatch(paused, { isActive: true }, "2026-06-15");
    expect(patch.nextOccurrence).toBe("2026-07-05");

    const resumed = { ...paused, ...patch } as RecurringRule;
    const { created } = materializeRecurring([resumed], [], "2026-06-15", id);
    expect(created).toHaveLength(0);
    // Le mois suivant, une seule échéance est générée.
    expect(materializeRecurring([resumed], [], "2026-07-05", id).created.map((t) => t.date)).toEqual(["2026-07-05"]);
  });

  it("réactivée le jour même d'une échéance : cette échéance est générée une fois, pas les précédentes", () => {
    const patch = resolveRecurringPatch(rule(), { isActive: true }, "2026-06-05");
    expect(patch.nextOccurrence).toBe("2026-06-05");
    const resumed = { ...rule(), ...patch } as RecurringRule;
    const first = materializeRecurring([resumed], [], "2026-06-05", id);
    expect(first.created.map((t) => t.date)).toEqual(["2026-06-05"]);
    expect(materializeRecurring(first.rules, first.transactions, "2026-06-05", id).created).toHaveLength(0);
  });

  it("garde le « fin de mois » d'une règle ancrée au 31", () => {
    const patch = resolveRecurringPatch(rule({ nextOccurrence: "2026-01-31", anchorDay: 31 }), { isActive: true }, "2026-04-10");
    expect(patch.nextOccurrence).toBe("2026-04-30");
    expect(patch.anchorDay).toBe(31);
    expect(firstOccurrenceFrom({ nextOccurrence: "2026-04-30", frequency: "monthly", anchorDay: 31 }, "2026-05-01")).toBe("2026-05-31");
  });

  it("hebdomadaire : même jour de la semaine, à partir d'aujourd'hui", () => {
    const patch = resolveRecurringPatch(rule({ frequency: "weekly", anchorDay: undefined, nextOccurrence: "2026-03-02" }), { isActive: true }, "2026-06-10");
    expect(patch.nextOccurrence).toBe("2026-06-15"); // lundi
  });

  it("une règle restée active n'est pas décalée (pas de perte d'échéance)", () => {
    const active = rule({ isActive: true, nextOccurrence: "2026-06-05" });
    const patch = resolveRecurringPatch(active, { label: "Netflix Premium" }, "2026-06-10");
    expect(patch.nextOccurrence).toBe("2026-06-05");
    expect(materializeRecurring([{ ...active, ...patch } as RecurringRule], [], "2026-06-10", id).created).toHaveLength(1);
  });

  it("mettre en pause ne change pas la prochaine échéance", () => {
    const patch = resolveRecurringPatch(rule({ isActive: true, nextOccurrence: "2026-07-05" }), { isActive: false }, "2026-06-10");
    expect(patch.nextOccurrence).toBe("2026-07-05");
  });

  it("l'état local après réactivation ne projette aucune échéance passée", () => {
    const state = makeState({ today: "2026-06-15", recurring: [rule()] });
    const patch = resolveRecurringPatch(rule(), { isActive: true }, state.today);
    const data = deriveBudgetData(withUpdatedRecurring(state, "r1", patch));
    expect(data.recurring[0].nextOccurrence).toBe("2026-07-05");
    expect(data.upcoming.filter((u) => u.recurrenceId === "r1")).toHaveLength(0);
  });
});

describe("bug 2 — moyenne des tendances", () => {
  it("ignore les mois antérieurs au début de l'utilisation et le mois en cours", () => {
    const data = makeData({ today: "2026-10-12", transactions: [tx("2026-09-10", 300, "expense", "courses")] });
    const history = getMonthlyHistory(data);
    expect(history.map((h) => h.month)).toEqual(["2026-09", "2026-10"]);
    expect(history.at(-1)?.partial).toBe(true);
    expect(averageMonthlyExpenses(history)).toBe(300);
    expect(averagedMonthsCount(history)).toBe(1);
  });

  it("le mois en cours reste partiel même s'il contient des dépenses", () => {
    const data = makeData({
      today: "2026-10-12",
      transactions: [tx("2026-09-10", 300, "expense", "courses"), tx("2026-10-02", 900, "expense", "courses")],
    });
    expect(averageMonthlyExpenses(getMonthlyHistory(data))).toBe(300);
  });

  it("un mois sans aucune donnée au milieu n'est pas compté comme un mois à 0 €", () => {
    const data = makeData({
      today: "2026-10-12",
      transactions: [tx("2026-07-10", 200, "expense", "courses"), tx("2026-09-10", 400, "expense", "courses")],
    });
    const history = getMonthlyHistory(data);
    expect(history.map((h) => h.month)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(averageMonthlyExpenses(history)).toBe(300);
  });

  it("aucune donnée : seulement le mois en cours, moyenne nulle", () => {
    const history = getMonthlyHistory(makeData({ today: "2026-10-12" }));
    expect(history.map((h) => h.month)).toEqual(["2026-10"]);
    expect(averagedMonthsCount(history)).toBe(0);
    expect(averageMonthlyExpenses(history)).toBe(0);
  });
});

describe("bug 3 — catégorie archivée", () => {
  const plans = [{ month: "2026-09", planned: { courses: 300, loisirs: 200 }, incomeTarget: 2000, savingsTarget: 0 }];

  it("son enveloppe ne compte plus dans le budget du quotidien", () => {
    const state = makeState({ plans });
    expect(getMonthSummary(deriveBudgetData(state), "2026-09").variableBudget).toBe(500);
    const archived = withArchivedCategory(state, "loisirs");
    expect(getMonthSummary(deriveBudgetData(archived), "2026-09").variableBudget).toBe(300);
  });

  it("ses opérations restent dans les dépenses et l'historique", () => {
    const state = withArchivedCategory(makeState({ plans, transactions: [tx("2026-09-05", 40, "expense", "loisirs")] }), "loisirs");
    const data = deriveBudgetData(state);
    expect(data.transactions.map((t) => t.categoryId)).toContain("loisirs");
    expect(getMonthSummary(data, "2026-09").variable).toBe(40);
  });

  it("l'indicateur de santé est calculé sur le budget actif", () => {
    // 2000 € de revenus prévus, rien de dépensé : 2000 € pour 18 jours.
    const state = makeState({ plans: [{ ...plans[0], planned: { courses: 300, loisirs: 6000 } }] });
    expect(getMonthSummary(deriveBudgetData(state), "2026-09").health).toBe("tight");
    expect(getMonthSummary(deriveBudgetData(withArchivedCategory(state, "loisirs")), "2026-09").health).toBe("comfortable");
  });
});

describe("bug 5 — saisie des montants", () => {
  it("décimales et séparateur : virgule ou point", () => {
    expect(sanitizeAmount("12.5")).toBe("12,5");
    expect(sanitizeAmount("12,345")).toBe("12,34");
    expect(parseAmountInput(sanitizeAmount("1 234,56"))).toBe(1234.56);
  });

  it("montants négatifs et caractères invalides retirés", () => {
    expect(sanitizeAmount("-50")).toBe("50");
    expect(sanitizeAmount("abc")).toBe("");
    expect(sanitizeAmount("12€")).toBe("12");
    expect(sanitizeAmount("0012")).toBe("12");
    expect(sanitizeAmount(",5")).toBe("0,5");
  });

  it("valeur vide ou inachevée : un nombre valide", () => {
    expect(parseAmountInput("")).toBe(0);
    expect(parseAmountInput(sanitizeAmount("12,"))).toBe(12);
    expect(parseAmountInput(sanitizeAmount("99999999"))).toBe(9999999);
  });
});
