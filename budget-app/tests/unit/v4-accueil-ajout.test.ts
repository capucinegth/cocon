/** V4 : argent sur les comptes, garde de trésorerie (option A) et suggestions locales de l'ajout rapide. */
import { describe, expect, it } from "vitest";
import { getMonthSummary, monthUpcoming } from "@/lib/budget";
import { knownLabels, matchMerchant, merchantKey, rankCategories } from "@/lib/suggestions";
import { getMoneyOverview, getTreasuryAlert, type TreasuryInput } from "@/lib/treasury";
import type { Account } from "@/types/finance";
import { createDemoState } from "@/services/demo-repository";
import { deriveBudgetData } from "@/store/budget-state";
import { tx } from "./fixtures";

const demo = () => {
  const state = createDemoState();
  return { data: deriveBudgetData(state), all: state.transactions };
};

const accounts: Account[] = [
  { id: "courant", label: "Compte courant", emoji: "🏦", type: "checking", initialBalance: 500, isActive: true },
  { id: "livret", label: "Livret A", emoji: "🌱", type: "savings", initialBalance: 1000, isActive: true },
];

describe("Mon argent : trois chiffres distincts", () => {
  it("sur tes comptes (hors épargne), épargne, tout ton argent", () => {
    const transactions = [tx("2026-09-02", 100, "saving", "epargne", { transferAccountId: "livret" }), tx("2026-09-20", 50, "expense", "courses")];
    expect(getMoneyOverview(accounts, transactions, "2026-09-13")).toEqual({ onAccounts: 400, savings: 1100, total: 1500 });
  });

  it("démo : 1 949,49 € sur les comptes, 650 € d'épargne, 2 599,49 € en tout", () => {
    const { data, all } = demo();
    expect(getMoneyOverview(data.accounts, all, data.today)).toEqual({ onAccounts: 1949.49, savings: 650, total: 2599.49 });
  });
});

describe("garde de trésorerie (option A) : le chiffre du budget n'est jamais remplacé", () => {
  const base = (partial: Partial<TreasuryInput>): TreasuryInput => ({
    accounts,
    transactions: [],
    upcoming: [],
    today: "2026-09-13",
    remaining: 200,
    incomeExpected: 0,
    ...partial,
  });
  const expense = (date: string, amount: number) => ({ accountId: "courant", amount, kind: "expense" as const, date });

  it("aucune alerte quand les comptes couvrent les opérations à venir et le disponible", () => {
    expect(getTreasuryAlert(base({ upcoming: [expense("2026-09-15", 250)] }))).toBeNull();
  });

  it("« short » : en fin de mois, il resterait moins que ce que le budget laisse à dépenser", () => {
    expect(getTreasuryAlert(base({ upcoming: [expense("2026-09-15", 400)] }))).toEqual({ kind: "short", endBalance: 100, remaining: 200 });
  });

  it("« overdraft » : le solde passerait sous zéro, à la date du point le plus bas", () => {
    const alert = getTreasuryAlert(
      base({ upcoming: [expense("2026-09-20", 300), expense("2026-09-15", 450), { accountId: "courant", amount: 1000, kind: "income", date: "2026-09-25" }] }),
    );
    expect(alert).toEqual({ kind: "overdraft", lowest: -250, date: "2026-09-20", beforeExpectedIncome: false });
  });

  it("un revenu attendu (pas encore saisi) compte en fin de mois, mais pas pour le point le plus bas", () => {
    expect(getTreasuryAlert(base({ upcoming: [expense("2026-09-15", 400)], incomeExpected: 2000 }))).toBeNull();
    expect(getTreasuryAlert(base({ upcoming: [expense("2026-09-15", 600)], incomeExpected: 2000 }))).toMatchObject({ kind: "overdraft", beforeExpectedIncome: true });
  });

  it("un versement vers l'épargne sort des comptes ; l'argent du Livret A ne couvre pas les dépenses", () => {
    const upcoming = [{ accountId: "courant", transferAccountId: "livret", amount: 350, kind: "saving" as const, date: "2026-09-14" }];
    expect(getTreasuryAlert(base({ upcoming }))).toEqual({ kind: "short", endBalance: 150, remaining: 200 });
  });

  it("le solde du jour ne compte que les opérations passées (une opération future arrive par « à venir »)", () => {
    const transactions = [tx("2026-09-20", 450, "expense", "courses")];
    expect(getTreasuryAlert(base({ transactions }))).toBeNull();
  });

  it("sans compte hors épargne, aucune alerte (rien à affirmer)", () => {
    expect(getTreasuryAlert(base({ accounts: [accounts[1]], upcoming: [expense("2026-09-15", 9999)] }))).toBeNull();
  });

  it("budget déjà à zéro ou négatif : pas d'alerte « short » (l'état du budget le dit déjà)", () => {
    expect(getTreasuryAlert(base({ remaining: 0, upcoming: [expense("2026-09-15", 450)] }))).toBeNull();
  });

  it("démo : 1 949,49 € − 819,99 € à venir = 1 129,50 € ≥ 643,20 € : aucune alerte", () => {
    const { data, all } = demo();
    const summary = getMonthSummary(data, "2026-09");
    expect(summary.remaining).toBe(643.2);
    const input = { accounts: data.accounts, transactions: all, upcoming: monthUpcoming(data, "2026-09"), today: data.today };
    expect(getTreasuryAlert({ ...input, remaining: summary.remaining, incomeExpected: summary.incomeExpected })).toBeNull();
    expect(getTreasuryAlert({ ...input, remaining: 1200, incomeExpected: 0 })).toEqual({ kind: "short", endBalance: 1129.5, remaining: 1200 });
  });
});

describe("suggestions locales de l'ajout rapide", () => {
  const history = [
    tx("2026-09-12", 20, "expense", "courses", { label: "Carrefour" }),
    tx("2026-09-10", 30, "expense", "courses", { label: "CARREFOUR ", accountId: "joint" }),
    tx("2026-09-11", 12, "expense", "restaurants", { label: "Trattoria Mia" }),
    tx("2026-09-05", 15, "expense", "transport", { label: "Navigo" }),
    tx("2026-09-06", 15, "expense", "transport", { label: "Navigo" }),
    tx("2026-04-01", 99, "expense", "shopping", { label: "Zara" }), // hors fenêtre de 120 jours
    tx("2026-09-20", 99, "expense", "loisirs", { label: "Cinéma" }), // future : ignorée
    tx("2026-09-01", 2000, "income", "salaire", { label: "Salaire" }),
  ];
  const allowed = ["logement", "courses", "transport", "restaurants", "loisirs", "shopping"];

  it("marchand : sans accents, casse ni espaces en trop", () => {
    expect(merchantKey("  Carrefour   City! ")).toBe("carrefour city");
    expect(merchantKey("Épicerie")).toBe("epicerie");
  });

  it("catégories : les plus utilisées récemment d'abord, puis l'ordre habituel", () => {
    expect(rankCategories(history, "expense", "2026-09-13", allowed)).toEqual(["courses", "transport", "restaurants", "logement", "loisirs", "shopping"]);
  });

  it("à égalité, la plus récente d'abord ; aucun historique : l'ordre habituel", () => {
    const tie = [tx("2026-09-01", 1, "expense", "transport"), tx("2026-09-09", 1, "expense", "loisirs")];
    expect(rankCategories(tie, "expense", "2026-09-13", allowed).slice(0, 2)).toEqual(["loisirs", "transport"]);
    expect(rankCategories([], "expense", "2026-09-13", allowed)).toEqual(allowed);
  });

  it("un marchand déjà vu reprend la catégorie et le compte de sa dernière opération", () => {
    expect(matchMerchant(history, "expense", "carrefour", "2026-09-13")).toEqual({ label: "Carrefour", categoryId: "courses", accountId: "courant" });
    expect(matchMerchant(history, "expense", "Zara", "2026-09-13")?.categoryId).toBe("shopping");
    expect(matchMerchant(history, "expense", "Inconnu", "2026-09-13")).toBeNull();
    expect(matchMerchant(history, "income", "Carrefour", "2026-09-13")).toBeNull();
    expect(matchMerchant(history, "expense", "C", "2026-09-13")).toBeNull();
  });

  it("libellés connus : uniques, du plus fréquent au moins fréquent, sans les opérations futures", () => {
    expect(knownLabels(history, "expense", "2026-09-13")).toEqual(["Carrefour", "Navigo", "Trattoria Mia", "Zara"]);
  });
});
