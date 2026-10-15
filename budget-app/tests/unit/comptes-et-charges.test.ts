/** Créer un compte et ajouter une charge fixe : construction, effet sur les soldes, enregistrement. */
import { describe, expect, it } from "vitest";
import { accountChoices, destinationChoices, liquidBalance } from "@/lib/accounts";
import { firstMonthlyDebit, materializeRecurring } from "@/lib/recurrence";
import { newAccountToRow, recurringToRow } from "@/services/mappers";
import { createSupabaseRepository } from "@/services/supabase-repository";
import { buildAccount, buildFixedCharge, deriveBudgetData, withAccount, withRecurring } from "@/store/budget-state";
import { fakeClient } from "./fake-supabase";
import { makeState, tx } from "./fixtures";

const ids = () => {
  let n = 0;
  return () => `id-${(n += 1)}`;
};

describe("créer un compte", () => {
  it("nom nettoyé, emoji du type, solde arrondi, actif", () => {
    const account = buildAccount({ label: "  Boursorama ", type: "checking", initialBalance: 120.456 }, () => "b1");
    expect(account).toEqual({ id: "b1", label: "Boursorama", emoji: account.emoji, type: "checking", initialBalance: 120.46, isActive: true });
    expect(account.emoji).toBeTruthy();
  });

  it("un compte courant est proposé pour les opérations et compte dans le solde hors épargne", () => {
    const state = withAccount(makeState(), buildAccount({ label: "Boursorama", type: "checking", initialBalance: 200 }, () => "b1"));
    expect(accountChoices(state.accounts, "expense").map((a) => a.id)).toContain("b1");
    const before = liquidBalance(makeState().accounts, [], "2026-09-13");
    expect(liquidBalance(state.accounts, [], "2026-09-13")).toBe(before + 200);
  });

  it("un compte d'épargne n'est proposé que comme destination d'une épargne et n'entre pas dans le solde hors épargne", () => {
    const state = withAccount(makeState(), buildAccount({ label: "LDDS", type: "savings", initialBalance: 500 }, () => "ldds"));
    expect(accountChoices(state.accounts, "expense").map((a) => a.id)).not.toContain("ldds");
    expect(destinationChoices(state.accounts).map((a) => a.id)).toContain("ldds");
    expect(liquidBalance(state.accounts, [], "2026-09-13")).toBe(liquidBalance(makeState().accounts, [], "2026-09-13"));
  });

  it("démo : les soldes d'ouverture figés suivent un nouveau compte hors épargne", () => {
    const state = withAccount(makeState({ openingBalances: { "2026-09": 1000 } }), buildAccount({ label: "Porte-monnaie", type: "cash", initialBalance: 40 }, () => "c1"));
    expect(state.openingBalances).toEqual({ "2026-09": 1040 });
    const savings = withAccount(makeState({ openingBalances: { "2026-09": 1000 } }), buildAccount({ label: "PEL", type: "savings", initialBalance: 40 }, () => "p1"));
    expect(savings.openingBalances).toEqual({ "2026-09": 1000 });
  });

  it("ajouter deux fois le même compte ne le duplique pas", () => {
    const account = buildAccount({ label: "B", type: "checking", initialBalance: 0 }, () => "b1");
    expect(withAccount(withAccount(makeState(), account), account).accounts.filter((a) => a.id === "b1")).toHaveLength(1);
  });

  it("ligne insérée : type et ordre, jamais user_id (rempli par la base, contrôlé par la RLS)", async () => {
    const account = buildAccount({ label: "Boursorama", type: "joint", initialBalance: -15 }, () => "b1");
    const row = newAccountToRow(account, 40);
    expect(row).toMatchObject({ id: "b1", type: "joint", sort_order: 40, name: "Boursorama", initial_balance_cents: -1500, is_active: true });
    expect(row).not.toHaveProperty("user_id");
    const { client, calls } = fakeClient();
    await createSupabaseRepository(client).createAccount(account, 40);
    expect(calls).toEqual([{ table: "accounts", values: row, filters: [] }]);
  });
});

describe("charges fixes : premier prélèvement", () => {
  it("jour encore à venir ce mois-ci : ce mois-ci", () => {
    expect(firstMonthlyDebit(20, "2026-09-13")).toBe("2026-09-20");
  });

  it("jour déjà passé ce mois-ci : pas de rattrapage, le mois prochain", () => {
    expect(firstMonthlyDebit(5, "2026-09-13")).toBe("2026-10-05");
  });

  it("jour du prélèvement = aujourd'hui : considéré comme déjà dans le solde, le mois prochain", () => {
    expect(firstMonthlyDebit(13, "2026-09-13")).toBe("2026-10-13");
  });

  it("« le 31 » : dernier jour des mois plus courts, puis de nouveau le 31", () => {
    expect(firstMonthlyDebit(31, "2026-09-13")).toBe("2026-09-30");
    expect(firstMonthlyDebit(31, "2026-09-30")).toBe("2026-10-31");
    expect(firstMonthlyDebit(30, "2026-02-28")).toBe("2026-03-30");
    expect(firstMonthlyDebit(30, "2026-01-31")).toBe("2026-02-28");
  });
});

describe("charges fixes : effet sur le solde", () => {
  const base = makeState({ transactions: [tx("2026-09-01", 2000, "income", "salaire")] });
  const charge = (day: number) =>
    buildFixedCharge({ label: " Loyer ", amount: 650, categoryId: "logement", accountId: "courant", day }, base.today, ids());

  it("règle mensuelle avec le jour d'ancrage, aucune opération créée", () => {
    const rule = charge(5);
    expect(rule).toMatchObject({ label: "Loyer", amount: 650, kind: "expense", frequency: "monthly", anchorDay: 5, nextOccurrence: "2026-10-05", isActive: true });
    expect(recurringToRow(rule)).toMatchObject({ anchor_day: 5, next_occurrence: "2026-10-05", type: "expense", amount_cents: 65000 });
  });

  it("prélèvement de ce mois déjà passé : ni déduit du solde actuel, ni prévu ce mois-ci, ni généré au chargement", () => {
    const state = withRecurring(base, charge(5));
    const before = deriveBudgetData(base);
    const after = deriveBudgetData(state);
    expect(liquidBalance(after.accounts, after.transactions, base.today)).toBe(liquidBalance(before.accounts, before.transactions, base.today));
    expect(after.upcoming.filter((u) => u.label === "Loyer")).toEqual([]);
    const { created } = materializeRecurring(state.recurring, state.transactions, base.today, ids(), state.accounts);
    expect(created).toEqual([]);
  });

  it("prélèvement encore à venir ce mois-ci : prévu (à venir), pas encore déduit", () => {
    const state = withRecurring(base, charge(25));
    const data = deriveBudgetData(state);
    expect(data.upcoming.filter((u) => u.label === "Loyer").map((u) => u.date)).toEqual(["2026-09-25"]);
    expect(liquidBalance(data.accounts, data.transactions, base.today)).toBe(liquidBalance(deriveBudgetData(base).accounts, deriveBudgetData(base).transactions, base.today));
  });

  it("le mois suivant, le prélèvement est généré à sa date", () => {
    const state = withRecurring(base, charge(5));
    const { created } = materializeRecurring(state.recurring, state.transactions, "2026-10-05", ids(), state.accounts);
    expect(created.map((t) => [t.label, t.date, t.amount])).toEqual([["Loyer", "2026-10-05", 650]]);
  });

  it("jour hors limites ramené entre 1 et 31", () => {
    expect(buildFixedCharge({ label: "X", amount: 1, categoryId: "logement", accountId: "courant", day: 45 }, base.today, ids()).anchorDay).toBe(31);
    expect(buildFixedCharge({ label: "X", amount: 1, categoryId: "logement", accountId: "courant", day: 0 }, base.today, ids()).anchorDay).toBe(1);
  });

  it("enregistrement : une seule ligne de règle, aucune opération", async () => {
    const rule = charge(5);
    const { client, calls } = fakeClient();
    await createSupabaseRepository(client).createRecurring(rule);
    expect(calls).toEqual([{ table: "recurring_transactions", values: recurringToRow(rule), filters: [] }]);
  });
});
