/**
 * Le dépôt Supabase de l'application, testé contre une vraie pile locale
 * (Auth + PostgREST + PostgreSQL avec les migrations et la RLS de Cocon).
 */
import { describe, expect, it } from "vitest";
import { addDays, addMonths, monthKey } from "@/lib/dates";
import { todayInParis } from "@/lib/paris-time";
import { uuid } from "@/lib/ids";
import { RepositoryError } from "@/services/repository";
import { createSupabaseRepository } from "@/services/supabase-repository";
import { buildGoal, buildTransaction } from "@/store/budget-state";
import { anonymousClient, localAnonKey, localUrl, signedInClient } from "./local-supabase";

const suite = localUrl && localAnonKey ? describe : describe.skip;
const today = todayInParis();
const month = monthKey(today);

suite("dépôt Supabase (pile locale)", () => {
  it("un nouveau compte est prêt : profil, 13 catégories, 3 comptes, aucune opération", async () => {
    const { client, email } = await signedInClient("neuf", "Camille");
    const state = await createSupabaseRepository(client).load(today);
    expect(state.profile).toMatchObject({ displayName: "Camille", email });
    expect(state.categories).toHaveLength(13);
    expect(state.categories.at(-1)?.group).toBe("epargne");
    expect(state.accounts.map((a) => a.label)).toEqual(["Compte courant", "Espèces", "Livret A"]);
    expect(state.transactions).toEqual([]);
    expect(state.plans).toEqual([]);
  });

  it("créer, relire, modifier et supprimer une opération (centimes exacts)", async () => {
    const { client } = await signedInClient("crud");
    const repo = createSupabaseRepository(client);
    const state = await repo.load(today);
    const courses = state.categories.find((c) => c.label === "Courses")!;
    const { transaction } = buildTransaction(
      state,
      { amount: 54.2, kind: "expense", categoryId: courses.id, accountId: state.accounts[0].id, date: today, recurrence: "none", label: "Carrefour" },
      uuid,
    );
    await repo.createTransaction(transaction);
    let reloaded = await repo.load(today);
    expect(reloaded.transactions).toEqual([{ ...transaction, recurrence: "none" }]);

    await repo.updateTransaction({ ...transaction, amount: 0.3, label: "Boulangerie", note: "croissants" });
    reloaded = await repo.load(today);
    expect(reloaded.transactions[0]).toMatchObject({ amount: 0.3, label: "Boulangerie", note: "croissants" });

    await repo.deleteTransaction(transaction);
    expect((await repo.load(today)).transactions).toEqual([]);
  });

  it("récurrence mensuelle : la règle est créée, les échéances passées sont générées une seule fois", async () => {
    const { client } = await signedInClient("recur");
    const repo = createSupabaseRepository(client);
    const state = await repo.load(today);
    const logement = state.categories.find((c) => c.label === "Logement")!;
    const start = `${addMonths(month, -2)}-${today.slice(8, 10) > "28" ? "28" : today.slice(8, 10)}`;
    const { transaction, rule } = buildTransaction(
      state,
      { amount: 650, kind: "expense", categoryId: logement.id, accountId: state.accounts[0].id, date: start, recurrence: "monthly", label: "Loyer" },
      uuid,
    );
    await repo.createTransaction(transaction, rule);
    const first = await repo.load(today);
    const loyers = first.transactions.filter((t) => t.recurrenceId === rule!.id).map((t) => t.date).sort();
    expect(loyers).toHaveLength(3); // il y a deux mois, le mois dernier, ce mois-ci
    expect(loyers.every((d) => d <= today)).toBe(true);
    expect(first.recurring[0].nextOccurrence > today).toBe(true);
    const second = await repo.load(today);
    expect(second.transactions).toHaveLength(3);

    await repo.updateRecurring(rule!.id, { isActive: false, amount: 700 });
    expect((await repo.load(today)).recurring[0]).toMatchObject({ isActive: false, amount: 700 });
    await repo.deleteRecurring(rule!.id);
    const after = await repo.load(today);
    expect(after.recurring).toEqual([]);
    expect(after.transactions.every((t) => t.recurrenceId === undefined && t.recurrence === "none")).toBe(true);
  });

  it("budgets : montant par catégorie, objectifs du mois, reprise au mois suivant", async () => {
    const { client } = await signedInClient("budget");
    const repo = createSupabaseRepository(client);
    const state = await repo.load(today);
    const courses = state.categories.find((c) => c.label === "Courses")!;
    await repo.setCategoryBudget(month, courses.id, 300);
    await repo.setMonthTargets(month, { incomeTarget: 2150, savingsTarget: 300 });
    const next = addMonths(month, 1);
    const loisirs = state.categories.find((c) => c.label === "Loisirs")!;
    await repo.setCategoryBudget(next, loisirs.id, 80);
    const plans = (await repo.load(today)).plans;
    expect(plans).toEqual([
      { month, planned: { [courses.id]: 300 }, incomeTarget: 2150, savingsTarget: 300 },
      { month: next, planned: { [courses.id]: 300, [loisirs.id]: 80 }, incomeTarget: 2150, savingsTarget: 300 },
    ]);
  });

  it("objectifs : création, versement, progression, modification, suppression", async () => {
    const { client } = await signedInClient("goal");
    const repo = createSupabaseRepository(client);
    const state = await repo.load(today);
    const goal = buildGoal({ label: "Vacances", emoji: "🌴", tone: "lilac", target: 2000, initialAmount: 1150, monthlyContribution: 100, deadline: addMonths(month, 6) }, uuid);
    await repo.createGoal(goal);
    const epargne = state.categories.find((c) => c.group === "epargne")!;
    const { transaction } = buildTransaction(
      { ...state, goals: [goal] },
      { amount: 100, kind: "saving", categoryId: epargne.id, accountId: state.accounts[0].id, date: today, recurrence: "none", goalId: goal.id },
      uuid,
    );
    await repo.createTransaction(transaction);
    let loaded = await repo.load(today);
    expect(loaded.goals[0]).toMatchObject({ saved: 1250, target: 2000, initialAmount: 1150, deadline: addMonths(month, 6) });

    await repo.updateGoal({ ...loaded.goals[0], target: 2500, label: "Voyage" });
    loaded = await repo.load(today);
    expect(loaded.goals[0]).toMatchObject({ label: "Voyage", target: 2500, saved: 1250 });

    await repo.deleteGoal(goal.id);
    loaded = await repo.load(today);
    expect(loaded.goals).toEqual([]);
    expect(loaded.transactions[0]).toMatchObject({ amount: 100, goalId: undefined });
  });

  it("catégories : création, nom en double refusé avec un message clair, archivage", async () => {
    const { client } = await signedInClient("cat");
    const repo = createSupabaseRepository(client);
    const id = uuid();
    await repo.createCategory({ id, label: "Animaux", emoji: "🐾", group: "variables", tone: "blush" });
    await expect(repo.createCategory({ id: uuid(), label: "animaux", emoji: "🐾", group: "variables", tone: "blush" })).rejects.toMatchObject({
      kind: "conflict",
      message: "Cet élément existe déjà (même nom).",
    });
    await repo.archiveCategory(id);
    const animaux = (await repo.load(today)).categories.find((c) => c.id === id);
    expect(animaux?.archived).toBe(true);
  });

  it("profil et préférences (mode discret) retrouvés au rechargement", async () => {
    const { client, userId } = await signedInClient("prefs");
    const repo = createSupabaseRepository(client);
    await repo.updateProfile(userId, { displayName: "Léa", preferences: { discreet: true, notifications: { eveningReminder: true } } });
    const { profile } = await repo.load(today);
    expect(profile).toMatchObject({ displayName: "Léa", preferences: { discreet: true, notifications: { eveningReminder: true } } });
  });

  it("isolation : un autre compte ne voit ni ne modifie rien", async () => {
    const alice = await signedInClient("alice");
    const bob = await signedInClient("bob");
    const aliceRepo = createSupabaseRepository(alice.client);
    const bobRepo = createSupabaseRepository(bob.client);
    const state = await aliceRepo.load(today);
    const { transaction } = buildTransaction(
      state,
      { amount: 42, kind: "expense", categoryId: state.categories[1].id, accountId: state.accounts[0].id, date: today, recurrence: "none", label: "Secret" },
      uuid,
    );
    await aliceRepo.createTransaction(transaction);

    const bobState = await bobRepo.load(today);
    expect(bobState.transactions).toEqual([]);
    expect(bobState.categories.some((c) => state.categories.some((a) => a.id === c.id))).toBe(false);
    await expect(bobRepo.updateTransaction({ ...transaction, amount: 1 })).rejects.toBeInstanceOf(RepositoryError);
    await bobRepo.deleteTransaction(transaction);
    // Bob ne peut pas non plus rattacher une opération à une catégorie d'Alice.
    await expect(
      bobRepo.createTransaction({ ...transaction, id: uuid(), accountId: bobState.accounts[0].id }),
    ).rejects.toBeInstanceOf(RepositoryError);
    expect((await aliceRepo.load(today)).transactions).toEqual([{ ...transaction, recurrence: "none" }]);
  });

  it("sans session : erreur « session expirée », aucune donnée", async () => {
    await expect(createSupabaseRepository(anonymousClient()).load(today)).rejects.toMatchObject({ kind: "auth" });
  });

  it("une opération datée dans le futur reste une opération (pas générée deux fois)", async () => {
    const { client } = await signedInClient("futur");
    const repo = createSupabaseRepository(client);
    const state = await repo.load(today);
    const { transaction } = buildTransaction(
      state,
      { amount: 80, kind: "expense", categoryId: state.categories[1].id, accountId: state.accounts[0].id, date: addDays(today, 5), recurrence: "none" },
      uuid,
    );
    await repo.createTransaction(transaction);
    expect((await repo.load(today)).transactions.map((t) => t.date)).toEqual([addDays(today, 5)]);
  });
});
