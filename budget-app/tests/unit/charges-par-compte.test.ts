/** Actualiser le solde d'un compte et charges fixes prévues par compte. */
import { describe, expect, it } from "vitest";
import { accountBalance, initialBalanceFor } from "@/lib/accounts";
import { getFixedChargesByAccount, occurrencesInMonth } from "@/lib/fixed-charges";
import type { RecurringRule } from "@/types/finance";
import { makeData, tx } from "./fixtures";

function rule(id: string, amount: number, nextOccurrence: string, extra: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id,
    label: id,
    amount,
    kind: "expense",
    categoryId: "abonnements",
    accountId: "courant",
    frequency: "monthly",
    nextOccurrence,
    anchorDay: Number(nextOccurrence.slice(8, 10)),
    isActive: true,
    ...extra,
  };
}

describe("actualiser le solde d'un compte", () => {
  const transactions = [
    tx("2026-09-01", 2000, "income", "salaire"),
    tx("2026-09-02", 650, "expense", "logement"),
    tx("2026-09-03", 200, "saving", "epargne", { transferAccountId: "livret" }),
    tx("2026-09-20", 100, "expense", "courses"), // future : hors du solde du jour
  ];

  it("recale le solde de départ pour retrouver le solde de la banque, sans toucher aux opérations", () => {
    const initialBalance = initialBalanceFor("courant", 2100, transactions, "2026-09-13");
    expect(initialBalance).toBe(950);
    expect(accountBalance({ id: "courant", initialBalance }, transactions, "2026-09-13")).toBe(2100);
    expect(accountBalance({ id: "courant", initialBalance }, transactions, "2026-09-30")).toBe(2000);
  });

  it("compte d'épargne : les versements reçus sont pris en compte", () => {
    expect(initialBalanceFor("livret", 3200, transactions, "2026-09-13")).toBe(3000);
  });

  it("accepte un découvert et garde les centimes justes", () => {
    const initialBalance = initialBalanceFor("courant", -12.34, transactions, "2026-09-13");
    expect(accountBalance({ id: "courant", initialBalance }, transactions, "2026-09-13")).toBe(-12.34);
  });
});

describe("échéances d'une règle dans un mois", () => {
  it("mensuelle : une échéance, le 31 devient le dernier jour des mois courts", () => {
    expect(occurrencesInMonth(rule("r", 10, "2026-10-31"), "2027-02")).toEqual(["2027-02-28"]);
    expect(occurrencesInMonth(rule("r", 10, "2026-10-05"), "2026-09")).toEqual(["2026-09-05"]);
  });

  it("hebdomadaire : même jour de la semaine, 4 ou 5 fois, avant ou après la prochaine échéance", () => {
    const weekly = rule("r", 10, "2026-10-07", { frequency: "weekly", anchorDay: undefined });
    expect(occurrencesInMonth(weekly, "2026-09")).toEqual(["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]);
    expect(occurrencesInMonth(weekly, "2026-11")).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"]);
  });
});

describe("charges fixes par compte", () => {
  // Aujourd'hui : 13 septembre 2026. Compte courant : solde de départ 390,30 €.
  const data = makeData({
    transactions: [tx("2026-09-01", 2000, "income", "salaire")],
    recurring: [
      rule("Loyer", 650, "2026-09-15", { categoryId: "logement" }),
      rule("Netflix", 17.99, "2026-10-05"), // déjà prélevé ce mois-ci
      rule("Salaire", 2150, "2026-09-28", { kind: "income", categoryId: "salaire" }),
      rule("Épargne", 300, "2026-09-20", { kind: "saving", categoryId: "epargne", transferAccountId: "livret" }),
      rule("En pause", 99, "2026-09-18", { isActive: false }),
      rule("Marché", 20, "2026-09-16", { frequency: "weekly", anchorDay: undefined, accountId: "especes", categoryId: "courses" }),
    ],
  });

  it("par compte : total du mois, encore à prélever, solde après prélèvements", () => {
    const [courant, especes, ...others] = getFixedChargesByAccount(data, "2026-09");
    expect(others).toEqual([]);
    expect(courant.account.id).toBe("courant");
    expect(courant.charges.map((c) => c.rule.id)).toEqual(["Netflix", "Loyer", "Épargne"]);
    expect(courant.monthly).toBe(967.99);
    expect(courant.remaining).toBe(950);
    expect(courant.balance).toBe(2390.3);
    expect(courant.afterCharges).toBe(1440.3);

    expect(especes.account.id).toBe("especes");
    expect(especes.monthly).toBe(100);
    expect(especes.remaining).toBe(60);
    expect(especes.afterCharges).toBe(-60);
  });

  it("compte aussi une échéance déjà créée à l'avance (datée plus tard dans le mois)", () => {
    const ahead = makeData({
      transactions: [tx("2026-09-25", 40, "expense", "abonnements", { recurrenceId: "Box", label: "Box" })],
      recurring: [rule("Box", 40, "2026-10-25")],
    });
    const [courant] = getFixedChargesByAccount(ahead, "2026-09");
    expect(courant.monthly).toBe(40);
    expect(courant.remaining).toBe(40);
  });

  it("un autre mois : ce qui partira d'office, sans « encore à prélever »", () => {
    const [courant, especes] = getFixedChargesByAccount(data, "2026-10");
    expect(courant.monthly).toBe(967.99);
    expect(courant.remaining).toBe(0);
    expect(especes.monthly).toBe(80);
  });

  it("ignore les comptes désactivés et leurs règles", () => {
    const off = makeData({
      accounts: data.accounts.map((a) => (a.id === "especes" ? { ...a, isActive: false } : a)),
      recurring: data.recurring,
    });
    expect(getFixedChargesByAccount(off, "2026-09").map((e) => e.account.id)).toEqual(["courant"]);
  });
});
