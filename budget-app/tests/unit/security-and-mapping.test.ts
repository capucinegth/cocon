import { describe, expect, it } from "vitest";
import { demoAccounts } from "@/config/accounts";
import { defaultCategories } from "@/config/categories";
import { authErrorMessage, validateCredentials } from "@/lib/auth-errors";
import { transactionsToCsv } from "@/lib/export";
import { safeNextPath } from "@/lib/safe-path";
import { isSecretKey, resolveSupabaseEnv } from "@/lib/supabase/env";
import { categoryFromRow, categoryToRow, fromCents, goalFromRow, goalToRow, planFromRow, toCents, transactionToRow } from "@/services/mappers";
import { toRepositoryError } from "@/services/supabase-repository";

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

describe("configuration Supabase", () => {
  it("refuse une clé secrète (service_role ou sb_secret_) côté navigateur", () => {
    expect(isSecretKey(jwt({ role: "service_role" }))).toBe(true);
    expect(isSecretKey("sb_secret_abc123")).toBe(true);
    expect(isSecretKey(jwt({ role: "anon" }))).toBe(false);
    expect(isSecretKey("sb_publishable_abc123")).toBe(false);
    const refused = resolveSupabaseEnv("https://exemple.supabase.co", jwt({ role: "service_role" }));
    expect(refused.env).toBeNull();
    expect(refused.problem).toMatch(/clé secrète/);
  });

  it("sans configuration : mode démo, sans erreur ; configuration partielle : signalée", () => {
    expect(resolveSupabaseEnv(undefined, undefined)).toEqual({ env: null });
    expect(resolveSupabaseEnv("https://exemple.supabase.co", undefined).problem).toMatch(/incomplète/);
    expect(resolveSupabaseEnv("pas-une-url", "sb_publishable_x").problem).toMatch(/URL/);
    expect(resolveSupabaseEnv("https://exemple.supabase.co/", "sb_publishable_x").env).toEqual({ url: "https://exemple.supabase.co", key: "sb_publishable_x" });
  });
});

describe("redirections après connexion", () => {
  it("n'accepte que des chemins internes", () => {
    expect(safeNextPath("/budget")).toBe("/budget");
    expect(safeNextPath("/transactions?mois=2026-09")).toBe("/transactions?mois=2026-09");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("messages d'erreur en français", () => {
  it("authentification", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 })).toBe("E-mail ou mot de passe incorrect.");
    expect(authErrorMessage({ code: "user_already_exists", status: 422 })).toMatch(/existe déjà/);
    expect(authErrorMessage({ code: "weak_password", status: 422 })).toMatch(/trop faible/);
    expect(authErrorMessage({ code: "over_request_rate_limit", status: 429 })).toMatch(/Trop de tentatives/);
    expect(authErrorMessage({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 })).toMatch(/Connexion impossible/);
    expect(authErrorMessage({ message: "something odd", status: 500 })).toMatch(/Réessaie/);
    expect(validateCredentials("pas-un-email", "motdepasse")).toMatch(/adresse e-mail/);
    expect(validateCredentials("a@b.fr", "court")).toMatch(/8 caractères/);
    expect(validateCredentials("a@b.fr", "assez-long")).toBeNull();
  });

  it("enregistrement des données", () => {
    expect(toRepositoryError({ code: "PGRST303", message: "JWT expired", status: 401 }, "charger").kind).toBe("auth");
    expect(toRepositoryError({ code: "", message: "TypeError: Failed to fetch", status: 0 }, "enregistrer l'opération").message).toMatch(/Connexion impossible/);
    expect(toRepositoryError({ code: "23505", message: "duplicate key" }, "créer").message).toMatch(/existe déjà/);
    expect(toRepositoryError({ code: "42501", message: "new row violates row-level security policy" }, "créer").message).toMatch(/refusée/);
    expect(toRepositoryError({ code: "XX000", message: "boom" }, "créer la catégorie").message).toBe("Impossible de créer la catégorie pour le moment. Réessaie dans un instant.");
  });
});

describe("conversion base ⇄ application", () => {
  it("montants en centimes entiers, sans erreur d'arrondi", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(54.2)).toBe(5420);
    expect(toCents(1234.565)).toBe(123457);
    expect(fromCents("5420")).toBe(54.2);
    expect(fromCents(null)).toBe(0);
  });

  it("catégories : types et couleurs", () => {
    const row = { id: "c1", name: "Courses", type: "variable" as const, icon: "🧺", color: "sage" as const, sort_order: 20, archived_at: null };
    const category = categoryFromRow(row);
    expect(category).toEqual({ id: "c1", label: "Courses", emoji: "🧺", group: "variables", tone: "sage", archived: undefined });
    expect(categoryToRow(category)).toMatchObject({ name: "Courses", type: "variable", icon: "🧺", color: "sage" });
    expect(categoryFromRow({ ...row, archived_at: "2026-09-01T10:00:00Z" }).archived).toBe(true);
  });

  it("objectifs : échéance au mois, progression lue dans la vue", () => {
    const goal = goalFromRow({
      id: "g1",
      name: "Vacances",
      icon: "🌴",
      color: "lilac",
      target_amount_cents: 200000,
      initial_amount_cents: 115000,
      monthly_contribution_cents: 10000,
      target_date: "2027-06-01",
      current_amount_cents: "125000",
    });
    expect(goal).toMatchObject({ saved: 1250, initialAmount: 1150, target: 2000, deadline: "2027-06" });
    expect(goalToRow(goal)).toMatchObject({ target_date: "2027-06-01", target_amount_cents: 200000 });
  });

  it("budgets : mois et montants par catégorie", () => {
    const plan = planFromRow({
      id: "b1",
      month: "2026-09-01",
      income_target_cents: 215000,
      savings_target_cents: 30000,
      budget_categories: [{ category_id: "c1", amount_cents: 30000 }],
    });
    expect(plan).toEqual({ month: "2026-09", planned: { c1: 300 }, incomeTarget: 2150, savingsTarget: 300 });
  });

  it("une opération qui n'est pas de l'épargne n'est jamais liée à un objectif", () => {
    const row = transactionToRow({ id: "t", label: "x", amount: 10, kind: "expense", categoryId: "c", accountId: "a", date: "2026-09-01", goalId: "g1" });
    expect(row.goal_id).toBeNull();
  });
});

describe("export CSV", () => {
  it("format français et protection contre les formules", () => {
    const csv = transactionsToCsv(
      [
        { id: "1", label: "=HYPERLINK(\"x\")", amount: 54.2, kind: "expense", categoryId: "courses", accountId: "courant", date: "2026-09-13" },
        { id: "2", label: "Salaire", amount: 2150, kind: "income", categoryId: "salaire", accountId: "courant", date: "2026-09-12", note: "Septembre; merci" },
      ],
      { categories: defaultCategories, accounts: demoAccounts, goals: [] },
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date;Libellé;Type;Catégorie;Objectif;Compte;Montant (€);Note");
    expect(lines[1]).toBe("2026-09-12;Salaire;Revenu;Salaire;;Compte courant;2150,00;\"Septembre; merci\"");
    expect(lines[2]).toBe("2026-09-13;\"'=HYPERLINK(\"\"x\"\")\";Dépense;Courses;;Compte courant;-54,20;");
  });
});
