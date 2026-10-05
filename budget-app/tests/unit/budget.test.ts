/**
 * Calculs du budget : chiffres de la démo (référence V2) et cas limites.
 */
import { describe, expect, it } from "vitest";
import { createDemoState } from "@/services/demo-repository";
import { getCategoryUsage, getExpenseUsages, getMonthSummary, getUsageStatus, planFor } from "@/lib/budget";
import { findCategory } from "@/config/categories";
import { deriveBudgetData } from "@/store/budget-state";
import { makeData, tx } from "./fixtures";

const plan = (month: string, planned: Record<string, number>, incomeTarget = 0, savingsTarget = 0) => ({ month, planned, incomeTarget, savingsTarget });

describe("données de démonstration (mêmes chiffres qu'en V2)", () => {
  const data = deriveBudgetData(createDemoState());

  it("septembre : 643,20 € disponibles, ≈ 35,73 € par jour sur 18 jours, budget confortable", () => {
    const s = getMonthSummary(data, "2026-09");
    expect(s.income).toBe(2150);
    expect(s.fixed).toBe(840);
    expect(s.variable).toBe(366.8);
    expect(s.savingsReserved).toBe(300);
    expect(s.remaining).toBe(643.2);
    expect(s.daysLeft).toBe(18);
    expect(s.perDay).toBeCloseTo(35.73, 2);
    expect(s.health).toBe("comfortable");
    expect(s.upcoming).toBe(819.99);
  });

  it("août (mois terminé) : il est resté 96 €", () => {
    const s = getMonthSummary(data, "2026-08");
    expect(s.isPast).toBe(true);
    expect(s.remaining).toBe(96);
    expect(s.health).toBe("closed");
    expect(s.daysLeft).toBe(0);
  });
});

describe("cas limites", () => {
  it("aucun revenu, aucune dépense : compte neuf, rien d'alarmant", () => {
    const s = getMonthSummary(makeData(), "2026-09");
    expect(s.income).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.isEmpty).toBe(true);
    expect(s.health).toBe("empty");
  });

  it("aucun revenu mais des dépenses : disponible négatif, budget serré", () => {
    const s = getMonthSummary(makeData({ transactions: [tx("2026-09-02", 40, "expense", "courses")] }), "2026-09");
    expect(s.remaining).toBe(-40);
    expect(s.health).toBe("tight");
  });

  it("revenu + dépenses : revenus − charges fixes − quotidien − épargne prévue", () => {
    const data = makeData({
      transactions: [
        tx("2026-09-01", 2000, "income", "salaire"),
        tx("2026-09-03", 650, "expense", "logement"),
        tx("2026-09-05", 120.35, "expense", "courses"),
        tx("2026-09-06", 0.1, "expense", "courses"),
        tx("2026-09-07", 0.2, "expense", "courses"),
      ],
      plans: [plan("2026-09", { courses: 300 }, 2000, 200)],
    });
    const s = getMonthSummary(data, "2026-09");
    expect(s.fixed).toBe(650);
    expect(s.variable).toBe(120.65); // pas d'erreur d'arrondi (0,1 + 0,2)
    expect(s.savingsReserved).toBe(200);
    expect(s.remaining).toBe(1029.35);
  });

  it("revenus attendus d'après le budget, tant qu'ils ne sont pas saisis", () => {
    const data = makeData({ plans: [plan("2026-09", {}, 2000, 0)], transactions: [tx("2026-09-02", 500, "income", "freelance")] });
    const s = getMonthSummary(data, "2026-09");
    expect(s.incomeReceived).toBe(500);
    expect(s.incomeExpected).toBe(1500);
    expect(s.income).toBe(2000);
  });

  it("dépenses supérieures au budget : catégorie en dépassement", () => {
    const data = makeData({
      transactions: [tx("2026-09-02", 180, "expense", "restaurants"), tx("2026-09-04", 70, "expense", "restaurants")],
      plans: [plan("2026-09", { restaurants: 200 }, 1000)],
    });
    const usage = getCategoryUsage(findCategory(data.categories, "restaurants"), data, "2026-09");
    expect(usage.remaining).toBe(-50);
    expect(usage.ratio).toBe(1.25);
    expect(getUsageStatus(usage.ratio)).toBe("over");
    expect(getUsageStatus(0.85)).toBe("warning");
    expect(getUsageStatus(0.5)).toBe("ok");
  });

  it("mois précédent : bilan avec la moyenne quotidienne, sans budget reconduit", () => {
    const data = makeData({
      transactions: [tx("2026-08-10", 1500, "income", "salaire"), tx("2026-08-12", 310, "expense", "courses")],
      plans: [plan("2026-09", { courses: 300 }, 2000, 100)],
    });
    const s = getMonthSummary(data, "2026-08");
    expect(s.isPast).toBe(true);
    expect(s.income).toBe(1500);
    expect(s.savingsReserved).toBe(0);
    expect(s.remaining).toBe(1190);
    expect(s.perDay).toBeCloseTo(10, 5);
  });

  it("dernier jour du mois : 1 jour restant, tout le disponible pour aujourd'hui", () => {
    const data = makeData({ today: "2026-09-30", transactions: [tx("2026-09-01", 1000, "income", "salaire"), tx("2026-09-20", 940, "expense", "logement")] });
    const s = getMonthSummary(data, "2026-09");
    expect(s.daysLeft).toBe(1);
    expect(s.dayOfMonth).toBe(30);
    expect(s.perDay).toBe(60);
  });

  it("février d'une année bissextile : 29 jours", () => {
    const s = getMonthSummary(makeData({ today: "2028-02-29" }), "2028-02");
    expect(s.daysInMonth).toBe(29);
    expect(s.daysLeft).toBe(1);
  });

  it("une opération datée dans le futur est « à venir » et déjà déduite", () => {
    const data = makeData({ transactions: [tx("2026-09-01", 1000, "income", "salaire"), tx("2026-09-25", 300, "expense", "logement")] });
    expect(data.transactions).toHaveLength(1);
    expect(data.upcoming.map((u) => u.date)).toEqual(["2026-09-25"]);
    const s = getMonthSummary(data, "2026-09");
    expect(s.paid).toBe(0);
    expect(s.fixedUpcoming).toBe(300);
    expect(s.remaining).toBe(700);
  });

  it("un revenu prévu n'est pas compté comme une dépense", () => {
    const data = makeData({ transactions: [tx("2026-09-28", 800, "income", "freelance")] });
    const s = getMonthSummary(data, "2026-09");
    expect(s.incomeUpcoming).toBe(800);
    expect(s.upcoming).toBe(0);
    expect(s.remaining).toBe(800);
  });

  it("le budget d'un mois sans budget reprend le dernier budget connu", () => {
    const data = makeData({ plans: [plan("2026-07", { courses: 250 }, 1800, 150)] });
    const reused = planFor(data, "2026-09");
    expect(reused?.inherited).toBe(true);
    expect(reused?.planned.courses).toBe(250);
    expect(planFor(data, "2026-06")).toBeNull();
  });

  it("une catégorie archivée disparaît du budget", () => {
    const base = makeData();
    const data = { ...base, categories: base.categories.map((c) => (c.id === "shopping" ? { ...c, archived: true } : c)) };
    expect(getExpenseUsages(data, "2026-09").map((u) => u.category.id)).not.toContain("shopping");
  });
});
