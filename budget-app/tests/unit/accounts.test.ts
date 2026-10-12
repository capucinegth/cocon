/** « Mes comptes » : soldes, choix dans les formulaires, modifications et enregistrement. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  accountBalance,
  accountChoices,
  canDeactivateAccount,
  liquidBalance,
  moveInOrder,
  preferredAccountId,
} from "@/lib/accounts";
import { getBalanceSeries } from "@/lib/timeline";
import { accountToRow } from "@/services/mappers";
import { createSupabaseRepository } from "@/services/supabase-repository";
import { deriveBudgetData, withAccountOrder, withUpdatedAccount } from "@/store/budget-state";
import type { Account } from "@/types/finance";
import { makeState, tx } from "./fixtures";

const accounts: Account[] = [
  { id: "courant", label: "Compte courant", emoji: "🏦", type: "checking", initialBalance: 1000, isActive: true },
  { id: "especes", label: "Espèces", emoji: "💶", type: "cash", initialBalance: 50, isActive: true },
  { id: "livret", label: "Livret A", emoji: "🌱", type: "savings", initialBalance: 3000, isActive: true },
];

describe("soldes des comptes", () => {
  const transactions = [
    tx("2026-09-01", 2000, "income", "salaire"),
    tx("2026-09-02", 650, "expense", "logement"),
    tx("2026-09-03", 200, "saving", "epargne"),
    tx("2026-09-04", 20, "expense", "courses", { accountId: "especes" }),
    tx("2026-09-05", 15, "income", "autres-revenus", { accountId: "livret", label: "Intérêts" }),
    tx("2026-09-20", 100, "expense", "courses"), // future : pas encore dans le solde
  ];

  it("solde = solde de départ + revenus − dépenses − épargne versée, jusqu'à la date donnée", () => {
    expect(accountBalance(accounts[0], transactions, "2026-09-13")).toBe(2150);
    expect(accountBalance(accounts[1], transactions, "2026-09-13")).toBe(30);
    expect(accountBalance(accounts[2], transactions, "2026-09-13")).toBe(3015);
    expect(accountBalance(accounts[0], transactions, "2026-09-30")).toBe(2050);
  });

  it("solde total hors épargne : comptes courants et espèces, sans le Livret A", () => {
    expect(liquidBalance(accounts, transactions, "2026-09-13")).toBe(2180);
  });

  it("un compte désactivé garde son solde dans le total (historique intact)", () => {
    const off = accounts.map((a) => (a.id === "especes" ? { ...a, isActive: false } : a));
    expect(liquidBalance(off, transactions, "2026-09-13")).toBe(2180);
  });

  it("le solde d'ouverture et la courbe du mois ignorent les opérations du Livret A", () => {
    const state = makeState({ accounts, transactions: [tx("2026-08-05", 15, "income", "salaire", { accountId: "livret" }), tx("2026-08-06", 40, "expense", "courses")] });
    const data = deriveBudgetData(state);
    expect(data.openingBalances["2026-09"]).toBe(1010);
    const withLivret = deriveBudgetData({ ...state, transactions: [...state.transactions, tx("2026-09-05", 500, "expense", "courses", { accountId: "livret" })] });
    expect(getBalanceSeries(withLivret, "2026-09").at(9)?.balance).toBe(1010);
  });
});

describe("comptes proposés dans les formulaires", () => {
  it("Livret A proposé pour un revenu ou une dépense, pas pour verser de l'épargne", () => {
    expect(accountChoices(accounts, "income").map((a) => a.id)).toEqual(["courant", "especes", "livret"]);
    expect(accountChoices(accounts, "expense").map((a) => a.id)).toContain("livret");
    expect(accountChoices(accounts, "saving").map((a) => a.id)).toEqual(["courant", "especes"]);
  });

  it("un compte désactivé n'est plus proposé, sauf pour l'opération qui l'utilise déjà", () => {
    const off = accounts.map((a) => (a.id === "especes" ? { ...a, isActive: false } : a));
    expect(accountChoices(off, "expense").map((a) => a.id)).not.toContain("especes");
    expect(accountChoices(off, "expense", "especes").map((a) => a.id)).toContain("especes");
  });

  it("compte par défaut : le compte courant actif, sinon un compte hors épargne", () => {
    expect(preferredAccountId(accounts)).toBe("courant");
    const off = accounts.map((a) => (a.id === "courant" ? { ...a, isActive: false } : a));
    expect(preferredAccountId(off)).toBe("especes");
    expect(preferredAccountId(off, "saving")).toBe("especes");
  });

  it("on ne peut pas désactiver le dernier compte actif hors épargne", () => {
    expect(canDeactivateAccount(accounts, "courant")).toBe(true);
    const onlyOne = accounts.map((a) => (a.id === "especes" ? { ...a, isActive: false } : a));
    expect(canDeactivateAccount(onlyOne, "courant")).toBe(false);
    expect(canDeactivateAccount(onlyOne, "livret")).toBe(true);
  });
});

describe("modifier ses comptes", () => {
  it("nom, solde de départ et état actif ; les opérations ne changent pas", () => {
    const state = makeState({ accounts, transactions: [tx("2026-09-02", 50, "expense", "courses", { accountId: "especes" })] });
    const next = withUpdatedAccount(state, "especes", { label: "  Porte-monnaie ", initialBalance: 80.456, isActive: false });
    const updated = next.accounts.find((a) => a.id === "especes")!;
    expect(updated).toMatchObject({ label: "Porte-monnaie", initialBalance: 80.46, isActive: false });
    expect(next.transactions).toEqual(state.transactions);
  });

  it("démo : les soldes d'ouverture figés suivent le nouveau solde de départ", () => {
    const state = makeState({ accounts, openingBalances: { "2026-08": 500, "2026-09": 700 } });
    const next = withUpdatedAccount(state, "courant", { initialBalance: 1200 });
    expect(next.openingBalances).toEqual({ "2026-08": 700, "2026-09": 900 });
    // Le Livret A ne fait pas partie du solde hors épargne.
    expect(withUpdatedAccount(state, "livret", { initialBalance: 9000 }).openingBalances).toEqual(state.openingBalances);
  });

  it("ordre d'affichage", () => {
    expect(moveInOrder(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveInOrder(["a", "b", "c"], "a", 5)).toEqual(["b", "c", "a"]);
    const state = withAccountOrder(makeState({ accounts }), ["livret", "courant", "especes"]);
    expect(state.accounts.map((a) => a.id)).toEqual(["livret", "courant", "especes"]);
  });

  it("ligne envoyée à la base : uniquement les champs modifiables, jamais user_id", () => {
    expect(accountToRow({ label: " Livret ", initialBalance: -12.5, isActive: true })).toEqual({
      name: "Livret",
      initial_balance_cents: -1250,
      is_active: true,
    });
  });
});

/** Client Supabase factice : enregistre les requêtes, chaque modification touche une ligne. */
function fakeClient() {
  const calls: { table: string; values: Record<string, unknown>; filters: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, values: {} as Record<string, unknown>, filters: [] as [string, unknown][] };
      calls.push(call);
      const query = {
        update(values: Record<string, unknown>) {
          call.values = values;
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return query;
        },
        select() {
          return query;
        },
        then(resolve: (result: { data: unknown; error: null }) => void) {
          resolve({ data: [{ id: "x" }], error: null });
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("enregistrement Supabase des comptes", () => {
  it("modification : par identifiant, sans user_id (la RLS limite aux comptes de l'utilisatrice)", async () => {
    const { client, calls } = fakeClient();
    await createSupabaseRepository(client).updateAccount({ ...accounts[2], label: "Livret A", initialBalance: 3100.5, isActive: false });
    expect(calls).toEqual([{ table: "accounts", values: { name: "Livret A", initial_balance_cents: 310050, is_active: false }, filters: [["id", "livret"]] }]);
  });

  it("ordre : positions 10, 20, 30", async () => {
    const { client, calls } = fakeClient();
    await createSupabaseRepository(client).reorderAccounts(["livret", "courant", "especes"]);
    expect(calls.map((c) => [c.values, c.filters])).toEqual([
      [{ sort_order: 10 }, [["id", "livret"]]],
      [{ sort_order: 20 }, [["id", "courant"]]],
      [{ sort_order: 30 }, [["id", "especes"]]],
    ]);
  });
});
