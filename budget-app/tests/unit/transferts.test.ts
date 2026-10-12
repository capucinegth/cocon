/**
 * V3 — l'épargne est un transfert entre deux comptes Cocon (source hors épargne → compte d'épargne).
 * Soldes, patrimoine, disponible, statistiques, interdictions, récurrences sur compte désactivé,
 * conversions et requêtes Supabase ; mot de passe ; objectifs au centime.
 */
import { describe, expect, it } from "vitest";
import {
  accountBalance,
  accountChoices,
  activeRulesUsingAccount,
  destinationChoices,
  liquidBalance,
  netWorth,
  preferredDestinationId,
  ruleAccountsActive,
} from "@/lib/accounts";
import { authErrorMessage, newPasswordProblem } from "@/lib/auth-errors";
import { isRecentRecovery, RECOVERY_REDIRECT } from "@/lib/auth-recovery";
import { getMonthSummary, getSpendingByCategory } from "@/lib/budget";
import { transactionsToCsv } from "@/lib/export";
import { getGoalProgress } from "@/lib/goals";
import { materializeRecurring, projectRecurring } from "@/lib/recurrence";
import { getBalanceSeries, getMonthlyHistory } from "@/lib/timeline";
import { recurringFromRow, recurringToRow, transactionFromRow, transactionToRow } from "@/services/mappers";
import { createSupabaseRepository } from "@/services/supabase-repository";
import {
  accountsProblem,
  buildTransaction,
  deriveBudgetData,
  editTransaction,
  resolveRecurringPatch,
  withTransaction,
  withUpdatedAccount,
  withUpdatedRecurring,
  withoutTransaction,
} from "@/store/budget-state";
import type { Account, RecurringRule, SavingsGoal } from "@/types/finance";
import { fakeClient } from "./fake-supabase";
import { makeState, tx } from "./fixtures";

const accounts: Account[] = [
  { id: "courant", label: "Compte courant", emoji: "🏦", type: "checking", initialBalance: 2000, isActive: true },
  { id: "especes", label: "Espèces", emoji: "💶", type: "cash", initialBalance: 0, isActive: true },
  { id: "livret", label: "Livret A", emoji: "🌱", type: "savings", initialBalance: 500, isActive: true },
];
let n = 0;
const id = () => `id${++n}`;
const saving = (date: string, amount: number, extra = {}) => tx(date, amount, "saving", "epargne", { transferAccountId: "livret", ...extra });

describe("transfert d'épargne : soldes et patrimoine", () => {
  it("2 000 € / 500 € puis transfert de 100 € : 1 900 € / 600 €, patrimoine inchangé", () => {
    const before = netWorth(accounts, [], "2026-09-13");
    const ops = [saving("2026-09-10", 100)];
    expect(accountBalance(accounts[0], ops, "2026-09-13")).toBe(1900);
    expect(accountBalance(accounts[2], ops, "2026-09-13")).toBe(600);
    expect(netWorth(accounts, ops, "2026-09-13")).toBe(before);
    expect(before).toBe(2500);
    expect(liquidBalance(accounts, ops, "2026-09-13")).toBe(1900);
  });

  it("aucun double comptage : la somme des comptes est le patrimoine", () => {
    const ops = [tx("2026-09-01", 1500, "income", "salaire"), tx("2026-09-02", 320.45, "expense", "courses"), saving("2026-09-03", 250.55)];
    const sum = accounts.reduce((acc, a) => acc + accountBalance(a, ops, "2026-09-13"), 0);
    expect(netWorth(accounts, ops, "2026-09-13")).toBe(Math.round(sum * 100) / 100);
    expect(netWorth(accounts, ops, "2026-09-13")).toBe(3679.55); // 2 500 + 1 500 − 320,45
  });

  it("un transfert futur ne compte pas encore", () => {
    expect(accountBalance(accounts[2], [saving("2026-09-20", 100)], "2026-09-13")).toBe(500);
  });

  it("ancienne épargne sans destination : sort du compte source, n'arrive sur aucun compte (comme avant)", () => {
    const legacy = [tx("2026-09-10", 100, "saving", "epargne")];
    expect(accountBalance(accounts[0], legacy, "2026-09-13")).toBe(1900);
    expect(accountBalance(accounts[2], legacy, "2026-09-13")).toBe(500);
    expect(netWorth(accounts, legacy, "2026-09-13")).toBe(2400);
  });

  it("modifier puis supprimer un transfert remet les soldes d'aplomb", () => {
    const s0 = makeState({ accounts });
    const input = { amount: 100, kind: "saving" as const, categoryId: "epargne", accountId: "courant", transferAccountId: "livret", date: "2026-09-10", recurrence: "none" as const };
    const { transaction } = buildTransaction(s0, input, id);
    let s = withTransaction(s0, transaction);
    const edited = editTransaction(s, transaction, { ...input, amount: 150, accountId: "especes" });
    s = withTransaction(withoutTransaction(s, transaction), edited);
    expect(accountBalance(accounts[1], s.transactions, "2026-09-13")).toBe(-150);
    expect(accountBalance(accounts[2], s.transactions, "2026-09-13")).toBe(650);
    s = withoutTransaction(s, edited);
    expect(netWorth(accounts, s.transactions, "2026-09-13")).toBe(2500);
    expect(accountBalance(accounts[2], s.transactions, "2026-09-13")).toBe(500);
  });
});

describe("disponible, budget et statistiques avec les transferts", () => {
  it("revenus 2 000 €, dépenses 300 €, épargne transférée 500 € : disponible 1 200 € = compte courant", () => {
    const zero = accounts.map((a) => ({ ...a, initialBalance: 0 }));
    const ops = [tx("2026-09-01", 2000, "income", "salaire"), tx("2026-09-02", 300, "expense", "courses"), saving("2026-09-03", 500)];
    const data = deriveBudgetData(makeState({ accounts: zero, transactions: ops }));
    const summary = getMonthSummary(data, "2026-09");
    expect(summary.committed).toBe(300); // l'épargne n'est pas une dépense
    expect(summary.saved).toBe(500);
    expect(summary.remaining).toBe(1200); // déduite une seule fois
    expect(accountBalance(zero[0], ops, "2026-09-13")).toBe(1200);
    expect(accountBalance(zero[2], ops, "2026-09-13")).toBe(500);
    expect(netWorth(zero, ops, "2026-09-13")).toBe(1700);
  });

  it("épargne prévue au budget : réservée une seule fois (versée ou non)", () => {
    const plans = [{ month: "2026-09", planned: {}, incomeTarget: 0, savingsTarget: 500 }];
    const base = [tx("2026-09-01", 2000, "income", "salaire")];
    const notYet = getMonthSummary(deriveBudgetData(makeState({ accounts, plans, transactions: base })), "2026-09");
    const done = getMonthSummary(deriveBudgetData(makeState({ accounts, plans, transactions: [...base, saving("2026-09-05", 500)] })), "2026-09");
    expect(notYet.remaining).toBe(1500);
    expect(done.remaining).toBe(1500);
  });

  it("statistiques : l'épargne n'apparaît ni dans les dépenses par catégorie ni dans les tendances", () => {
    const data = deriveBudgetData(makeState({ accounts, transactions: [tx("2026-08-02", 300, "expense", "courses"), saving("2026-08-03", 500)] }));
    expect(getSpendingByCategory(data, "2026-08").map((s) => s.category.id)).toEqual(["courses"]);
    expect(getMonthlyHistory(data).find((p) => p.month === "2026-08")?.expenses).toBe(300);
    expect(data.history.find((p) => p.month === "2026-08")?.savingsTotal).toBe(500);
  });

  it("courbe du solde hors épargne : le transfert sort du compte courant, le Livret A n'y entre pas", () => {
    const data = deriveBudgetData(makeState({ accounts, transactions: [saving("2026-09-05", 100)] }));
    expect(data.openingBalances["2026-09"]).toBe(2000);
    expect(getBalanceSeries(data, "2026-09")[5].balance).toBe(1900);
  });
});

describe("règles des comptes (interdictions)", () => {
  const ok = { kind: "saving" as const, accountId: "courant", transferAccountId: "livret" };
  it("transfert valide", () => {
    expect(accountsProblem(accounts, ok)).toBeNull();
  });
  it("depuis un compte d'épargne, vers un compte hors épargne, sans destination, même compte : refusés", () => {
    expect(accountsProblem(accounts, { ...ok, accountId: "livret" })).toMatch(/hors épargne/);
    expect(accountsProblem(accounts, { ...ok, transferAccountId: "especes" })).toMatch(/destination doit être un compte d'épargne/);
    expect(accountsProblem(accounts, { ...ok, transferAccountId: undefined })).toMatch(/compte d'épargne qui reçoit/);
    expect(accountsProblem(accounts, { ...ok, transferAccountId: "courant" })).toMatch(/destination/);
  });
  it("un compte d'épargne ne porte ni revenu ni dépense", () => {
    expect(accountsProblem(accounts, { kind: "income", accountId: "livret" })).toMatch(/transferts d'épargne/);
    expect(accountsProblem(accounts, { kind: "expense", accountId: "livret" })).toMatch(/transferts d'épargne/);
    expect(accountChoices(accounts, "expense").map((a) => a.id)).not.toContain("livret");
  });
  it("compte désactivé : refusé pour une nouvelle opération, accepté pour une opération qui l'utilise déjà", () => {
    const off = accounts.map((a) => (a.id === "livret" || a.id === "especes" ? { ...a, isActive: false } : a));
    expect(accountsProblem(off, { kind: "expense", accountId: "especes" })).toMatch(/désactivé/);
    expect(accountsProblem(off, { kind: "expense", accountId: "especes" }, { accountId: "especes" })).toBeNull();
    expect(accountsProblem(off, ok)).toMatch(/désactivé/);
    expect(accountsProblem(off, ok, { accountId: "courant", transferAccountId: "livret" })).toBeNull();
    expect(destinationChoices(off)).toEqual([]);
    expect(preferredDestinationId(off)).toBeUndefined();
    expect(destinationChoices(off, "livret").map((a) => a.id)).toEqual(["livret"]);
  });
});

describe("récurrences et comptes désactivés", () => {
  const rules: RecurringRule[] = [
    { id: "loyer", label: "Loyer", amount: 650, kind: "expense", categoryId: "logement", accountId: "courant", frequency: "monthly", nextOccurrence: "2026-10-05", anchorDay: 5, isActive: true },
    { id: "ep", label: "Épargne", amount: 100, kind: "saving", categoryId: "epargne", accountId: "courant", transferAccountId: "livret", frequency: "monthly", nextOccurrence: "2026-10-12", anchorDay: 12, isActive: true },
    { id: "cash", label: "Marché", amount: 20, kind: "expense", categoryId: "courses", accountId: "especes", frequency: "weekly", nextOccurrence: "2026-09-19", isActive: true },
  ];

  it("une épargne récurrente garde sa destination à la création et à la génération", () => {
    const s0 = makeState({ accounts });
    const { rule } = buildTransaction(s0, { amount: 100, kind: "saving", categoryId: "epargne", accountId: "courant", transferAccountId: "livret", date: "2026-09-12", recurrence: "monthly" }, id);
    expect(rule?.transferAccountId).toBe("livret");
    const { created } = materializeRecurring([rule!], [], "2026-10-12", id, accounts);
    expect(created.map((t) => [t.date, t.transferAccountId])).toEqual([["2026-10-12", "livret"]]);
  });

  it("récurrences à mettre en pause quand un compte est désactivé (source ou destination)", () => {
    expect(activeRulesUsingAccount(rules, "livret").map((r) => r.id)).toEqual(["ep"]);
    expect(activeRulesUsingAccount(rules, "courant").map((r) => r.id)).toEqual(["loyer", "ep"]);
    expect(activeRulesUsingAccount(rules, "especes").map((r) => r.id)).toEqual(["cash"]);
  });

  it("aucune opération générée ni projetée sur un compte désactivé (comme en base)", () => {
    const off = accounts.map((a) => (a.id === "especes" ? { ...a, isActive: false } : a));
    expect(materializeRecurring(rules, [], "2026-10-31", id, off).created.some((t) => t.accountId === "especes")).toBe(false);
    expect(projectRecurring(rules, [], "2026-09-13", "2026-09-30", off)).toEqual([]);
    expect(ruleAccountsActive(rules[2], off)).toBe(false);
  });

  it("désactiver → pause ; réactiver compte puis règle des mois plus tard : aucun rattrapage, aucun doublon", () => {
    let s = makeState({ accounts, recurring: rules, today: "2026-09-13" });
    for (const r of activeRulesUsingAccount(s.recurring, "especes")) s = withUpdatedRecurring(s, r.id, { isActive: false });
    s = withUpdatedAccount(s, "especes", { isActive: false });
    // Trois mois plus tard
    s = { ...withUpdatedAccount(s, "especes", { isActive: true }), today: "2026-12-16" };
    const rule = s.recurring.find((r) => r.id === "cash")!;
    expect(rule.isActive).toBe(false);
    const patch = resolveRecurringPatch(rule, { isActive: true }, s.today);
    expect(patch.nextOccurrence).toBe("2026-12-19"); // même jour de la semaine, à partir d'aujourd'hui
    s = withUpdatedRecurring(s, "cash", patch);
    const first = materializeRecurring(s.recurring, s.transactions, "2026-12-26", id, s.accounts);
    expect(first.created.filter((t) => t.recurrenceId === "cash").map((t) => t.date)).toEqual(["2026-12-19", "2026-12-26"]);
    expect(materializeRecurring(first.rules, first.transactions, "2026-12-26", id, s.accounts).created).toHaveLength(0);
  });
});

describe("conversions, export et requêtes Supabase", () => {
  it("compte de destination : aller-retour base, effacé pour un autre type d'opération", () => {
    const t = saving("2026-09-10", 100);
    const row = transactionToRow(t);
    expect(row.transfer_account_id).toBe("livret");
    expect(transactionFromRow({ ...row, description: row.description }, new Map(), (c) => c).transferAccountId).toBe("livret");
    expect(transactionToRow({ ...t, kind: "expense" }).transfer_account_id).toBeNull();
    const rule: RecurringRule = { id: "r", label: "Ép", amount: 100, kind: "saving", categoryId: "epargne", accountId: "courant", transferAccountId: "livret", frequency: "monthly", nextOccurrence: "2026-10-12", anchorDay: 12, isActive: true };
    expect(recurringFromRow({ ...recurringToRow(rule), id: "r" }, (c) => c)).toEqual(rule);
  });

  it("export CSV : « compte source → compte d'épargne »", () => {
    const csv = transactionsToCsv([saving("2026-09-10", 100, { label: "Virement" })], { ...makeState({ accounts }) });
    expect(csv.split("\r\n")[1]).toBe("2026-09-10;Virement;Épargne;Épargne;;Compte courant → Livret A;-100,00;");
  });

  it("requêtes : la destination est enregistrée, jamais de user_id", async () => {
    const { client, calls } = fakeClient();
    const rule: RecurringRule = { id: "r", label: "Ép", amount: 100, kind: "saving", categoryId: "epargne", accountId: "courant", frequency: "monthly", nextOccurrence: "2026-10-12", anchorDay: 12, isActive: true };
    await createSupabaseRepository(client).updateRecurring("r", resolveRecurringPatch(rule, { transferAccountId: "livret" }, "2026-09-13"));
    expect(calls[0].values).toMatchObject({ transfer_account_id: "livret" });
    expect(JSON.stringify(calls)).not.toContain("user_id");
  });
});

describe("mot de passe", () => {
  it("nouveau mot de passe : longueur et confirmation", () => {
    expect(newPasswordProblem("court", "court")).toMatch(/au moins 8/);
    expect(newPasswordProblem("motdepasse1", "motdepasse2")).toMatch(/pas identiques/);
    expect(newPasswordProblem("motdepasse1", "motdepasse1")).toBeNull();
  });
  it("messages d'erreur Supabase en français", () => {
    expect(authErrorMessage({ code: "same_password" })).toMatch(/différent/);
    expect(authErrorMessage({ code: "reauthentication_needed" })).toMatch(/reconnecte-toi/);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toMatch(/Trop de tentatives/);
  });
  it("retour d'un lien « mot de passe oublié » : reconnu pendant une heure seulement", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    expect(isRecentRecovery("2026-10-12T09:30:00Z", now)).toBe(true);
    expect(isRecentRecovery("2026-10-12T08:30:00Z", now)).toBe(false);
    expect(isRecentRecovery(null, now)).toBe(false);
    expect(RECOVERY_REDIRECT).toBe("/?motdepasse=nouveau");
  });
});

describe("objectifs au centime", () => {
  const goal = (saved: number, target: number, extra: Partial<SavingsGoal> = {}): SavingsGoal => ({ id: "g", label: "Vélo", emoji: "🚲", tone: "sage", saved, target, monthlyContribution: 50, ...extra });
  it("atteint pile au centime ; 1 centime manquant n'est pas atteint", () => {
    expect(getGoalProgress(goal(100.01, 100.01), "2026-09-13")).toMatchObject({ pace: "done", remaining: 0, ratio: 1 });
    expect(getGoalProgress(goal(100, 100.01), "2026-09-13")).toMatchObject({ remaining: 0.01 });
  });
  it("dépassement, rythme et date cible", () => {
    expect(getGoalProgress(goal(150, 100), "2026-09-13")).toMatchObject({ pace: "done", ratio: 1 });
    // 100 € à 50 €/mois : 2 mois → novembre 2026 ; 500 € : 10 mois → juillet 2027.
    expect(getGoalProgress(goal(0, 100, { deadline: "2026-12" }), "2026-09-13")).toMatchObject({ eta: "2026-11", pace: "ahead" });
    expect(getGoalProgress(goal(0, 100, { deadline: "2026-11" }), "2026-09-13")).toMatchObject({ pace: "on-track" });
    expect(getGoalProgress(goal(0, 500, { deadline: "2026-12" }), "2026-09-13")).toMatchObject({ eta: "2027-07", pace: "late" });
    expect(getGoalProgress(goal(0, 500, { monthlyContribution: 0 }), "2026-09-13")).toMatchObject({ pace: "no-deadline", eta: undefined });
  });
});
