/**
 * Sécurité des données : chaque utilisateur ne doit accéder qu'à SES lignes.
 * Tests exécutés sur un vrai PostgreSQL avec les vraies migrations et les vraies politiques RLS.
 */
import { readFileSync } from "node:fs";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, as, commitAs, createTestDatabase, createUser, migrationFiles } from "./helpers";

const suite = adminUrl ? describe : describe.skip;

suite("Base Cocon — inscription, RLS et fonctions", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;
  let aliceTx: string;
  let aliceGoal: string;
  let aliceBudget: string;

  /** Identifiants d'une catégorie / d'un compte de l'utilisateur. */
  const categoryId = async (userId: string, name: string) =>
    (await db.query("select id from public.categories where user_id = $1 and name = $2", [userId, name])).rows[0].id as string;
  const accountId = async (userId: string, name = "Compte courant") =>
    (await db.query("select id from public.accounts where user_id = $1 and name = $2", [userId, name])).rows[0].id as string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_rls"));
    alice = await createUser(db, "alice@example.com", "Alice");
    bob = await createUser(db, "bob@example.com");

    const courses = await categoryId(alice, "Courses");
    const epargne = await categoryId(alice, "Épargne");
    const courant = await accountId(alice);

    ({ aliceTx, aliceGoal, aliceBudget } = await commitAs(db, alice, async (q) => {
      const tx = await q(
        "insert into public.transactions (account_id, category_id, type, amount_cents, description, transaction_date) values ($1, $2, 'expense', 5420, 'Carrefour', '2026-09-13') returning id",
        [courant, courses],
      );
      const goal = await q(
        "insert into public.savings_goals (name, target_amount_cents, initial_amount_cents) values ('Vacances', 200000, 115000) returning id",
      );
      await q(
        "insert into public.transactions (account_id, category_id, goal_id, type, amount_cents, description, transaction_date) values ($1, $2, $3, 'saving', 10000, 'Versement', '2026-09-12')",
        [courant, epargne, goal.rows[0].id],
      );
      const budget = await q("select id from public.ensure_month_budget('2026-09-01')");
      await q("insert into public.budget_categories (budget_id, category_id, amount_cents) values ($1, $2, 30000)", [budget.rows[0].id, courses]);
      return { aliceTx: tx.rows[0].id as string, aliceGoal: goal.rows[0].id as string, aliceBudget: budget.rows[0].id as string };
    }));
  });

  afterAll(async () => {
    await drop?.();
  });

  describe("inscription", () => {
    it("crée le profil avec le nom choisi (ou le début de l'e-mail)", async () => {
      const { rows } = await db.query("select id, display_name from public.profiles order by display_name");
      expect(rows).toEqual([
        { id: alice, display_name: "Alice" },
        { id: bob, display_name: "bob" },
      ]);
    });

    it("crée les 13 catégories par défaut et 3 comptes, sans aucune donnée financière", async () => {
      const categories = await db.query("select count(*)::int as n from public.categories where user_id = $1", [bob]);
      const accounts = await db.query("select name from public.accounts where user_id = $1 order by sort_order", [bob]);
      const transactions = await db.query("select count(*)::int as n from public.transactions where user_id = $1", [bob]);
      expect(categories.rows[0].n).toBe(13);
      expect(accounts.rows.map((r) => r.name)).toEqual(["Compte courant", "Espèces", "Livret A"]);
      expect(transactions.rows[0].n).toBe(0);
    });
  });

  describe("isolation entre utilisateurs", () => {
    it("Bob ne voit aucune donnée d'Alice, dans aucune table", async () => {
      const counts = await as(db, bob, async (q) => {
        const tables = ["profiles", "accounts", "categories", "transactions", "savings_goals", "savings_goals_progress", "budgets", "budget_categories", "recurring_transactions"];
        const result: Record<string, number> = {};
        for (const table of tables) {
          const column = table === "profiles" ? "id" : table === "budget_categories" ? "(select user_id from public.budgets b where b.id = budget_id)" : "user_id";
          result[table] = (await q(`select count(*)::int as n from public.${table} where ${column} = $1`, [alice])).rows[0].n;
        }
        return result;
      });
      expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    });

    it("Alice voit ses propres données", async () => {
      const visible = await as(db, alice, async (q) => (await q("select id from public.transactions")).rows.map((r) => r.id));
      expect(visible).toContain(aliceTx);
    });

    it("Bob ne peut ni modifier ni supprimer une opération d'Alice", async () => {
      const result = await as(db, bob, async (q) => {
        const updated = await q("update public.transactions set amount_cents = 1 where id = $1", [aliceTx]);
        const deleted = await q("delete from public.transactions where id = $1", [aliceTx]);
        return { updated: updated.rowCount, deleted: deleted.rowCount };
      });
      expect(result).toEqual({ updated: 0, deleted: 0 });
      const { rows } = await db.query("select amount_cents from public.transactions where id = $1", [aliceTx]);
      expect(rows[0].amount_cents).toBe("5420");
    });

    it("Bob ne peut pas créer une ligne au nom d'Alice", async () => {
      const bobAccount = await accountId(bob);
      const bobCategory = await categoryId(bob, "Courses");
      await expect(
        as(db, bob, (q) =>
          q(
            "insert into public.transactions (user_id, account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, $3, 'expense', 100, '2026-09-01')",
            [alice, bobAccount, bobCategory],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("Bob ne peut pas rattacher son opération à une catégorie ou un compte d'Alice", async () => {
      const bobAccount = await accountId(bob);
      const aliceCategory = await categoryId(alice, "Courses");
      await expect(
        as(db, bob, (q) =>
          q("insert into public.transactions (account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, 'expense', 100, '2026-09-01')", [
            bobAccount,
            aliceCategory,
          ]),
        ),
      ).rejects.toThrow(/foreign key/);
    });

    it("Bob ne peut ni lire, ni modifier, ni supprimer le budget d'Alice", async () => {
      const result = await as(db, bob, async (q) => ({
        read: (await q("select * from public.budgets where id = $1", [aliceBudget])).rowCount,
        updated: (await q("update public.budgets set savings_target_cents = 1 where id = $1", [aliceBudget])).rowCount,
        deleted: (await q("delete from public.budgets where id = $1", [aliceBudget])).rowCount,
        lines: (await q("update public.budget_categories set amount_cents = 1 where budget_id = $1", [aliceBudget])).rowCount,
      }));
      expect(result).toEqual({ read: 0, updated: 0, deleted: 0, lines: 0 });
    });

    it("Bob ne peut pas ajouter une ligne dans le budget d'Alice, ni utiliser une catégorie d'Alice", async () => {
      const bobCategory = await categoryId(bob, "Courses");
      await expect(
        as(db, bob, (q) => q("insert into public.budget_categories (budget_id, category_id, amount_cents) values ($1, $2, 100)", [aliceBudget, bobCategory])),
      ).rejects.toThrow(/row-level security/);

      const aliceCategory = await categoryId(alice, "Loisirs");
      await expect(
        as(db, bob, async (q) => {
          const own = await q("select id from public.ensure_month_budget('2026-09-01')");
          return q("insert into public.budget_categories (budget_id, category_id, amount_cents) values ($1, $2, 100)", [own.rows[0].id, aliceCategory]);
        }),
      ).rejects.toThrow(/row-level security/);
    });

    it("Bob ne peut pas supprimer l'objectif d'Alice ni voir sa progression", async () => {
      const result = await as(db, bob, async (q) => ({
        deleted: (await q("delete from public.savings_goals where id = $1", [aliceGoal])).rowCount,
        progress: (await q("select * from public.savings_goals_progress where id = $1", [aliceGoal])).rowCount,
      }));
      expect(result).toEqual({ deleted: 0, progress: 0 });
    });

    it("Bob ne peut ni lire ni modifier le profil d'Alice", async () => {
      const result = await as(db, bob, async (q) => ({
        read: (await q("select * from public.profiles where id = $1", [alice])).rowCount,
        updated: (await q("update public.profiles set display_name = 'piraté' where id = $1", [alice])).rowCount,
      }));
      expect(result).toEqual({ read: 0, updated: 0 });
    });

    it("un visiteur non connecté n'a accès à rien", async () => {
      await expect(as(db, null, (q) => q("select * from public.transactions"))).rejects.toThrow(/permission denied/);
      await expect(as(db, null, (q) => q("select * from public.profiles"))).rejects.toThrow(/permission denied/);
      await expect(as(db, null, (q) => q("select public.materialize_recurring_transactions('2026-09-30')"))).rejects.toThrow(/permission denied/);
    });

    it("un visiteur non connecté ne voit pas la progression des objectifs", async () => {
      await expect(as(db, null, (q) => q("select * from public.savings_goals_progress"))).rejects.toThrow(/permission denied/);
    });

    it("les droits par défaut de Supabase sont retirés : ni TRUNCATE, ni création / suppression de profil", async () => {
      await expect(as(db, bob, (q) => q("truncate public.transactions"))).rejects.toThrow(/permission denied/);
      await expect(as(db, bob, (q) => q("delete from public.profiles where id = $1", [bob]))).rejects.toThrow(/permission denied/);
      await expect(
        as(db, bob, (q) => q("insert into public.profiles (id, display_name) values (gen_random_uuid(), 'intrus')")),
      ).rejects.toThrow(/permission denied/);
      const remaining = await db.query("select count(*)::int as n from public.transactions where user_id = $1", [alice]);
      expect(remaining.rows[0].n).toBeGreaterThan(0);
    });

    it("une fonction interne (préparation de compte) n'est pas appelable via l'API", async () => {
      await expect(as(db, bob, (q) => q("select public.handle_new_user()"))).rejects.toThrow(/permission denied/);
    });

    it("recalculer un budget d'Alice depuis le compte de Bob n'a aucun effet", async () => {
      const before = (await db.query("select fixed_expenses_target_cents, variable_expenses_target_cents, updated_at from public.budgets where id = $1", [aliceBudget])).rows[0];
      await commitAs(db, bob, (q) => q("select public.recompute_budget_targets($1)", [aliceBudget]));
      const after = (await db.query("select fixed_expenses_target_cents, variable_expenses_target_cents, updated_at from public.budgets where id = $1", [aliceBudget])).rows[0];
      expect(after).toEqual(before);
    });
  });

  describe("calculs côté base", () => {
    it("la progression d'un objectif = épargne initiale + versements (rien n'est stocké en double)", async () => {
      const { rows } = await as(db, alice, (q) => q("select current_amount_cents from public.savings_goals_progress where id = $1", [aliceGoal]));
      expect(rows[0].current_amount_cents).toBe("125000");
    });

    it("le budget tient à jour ses totaux fixes / quotidien à partir des catégories", async () => {
      const logement = await categoryId(alice, "Logement");
      const totals = await as(db, alice, async (q) => {
        await q("insert into public.budget_categories (budget_id, category_id, amount_cents) values ($1, $2, 72200)", [aliceBudget, logement]);
        return (await q("select fixed_expenses_target_cents as f, variable_expenses_target_cents as v from public.budgets where id = $1", [aliceBudget])).rows[0];
      });
      expect(totals).toEqual({ f: "72200", v: "30000" });
    });

    it("un nouveau mois reprend le budget précédent", async () => {
      const copied = await as(db, alice, async (q) => {
        const october = await q("select * from public.ensure_month_budget('2026-10-01')");
        const lines = await q("select amount_cents from public.budget_categories where budget_id = $1", [october.rows[0].id]);
        return { variable: october.rows[0].variable_expenses_target_cents, lines: lines.rows.map((r) => r.amount_cents) };
      });
      expect(copied).toEqual({ variable: "30000", lines: ["30000"] });
    });

    it("génère les opérations récurrentes sans dériver en fin de mois, une seule fois", async () => {
      const result = await as(db, alice, async (q) => {
        const account = (await q("select id from public.accounts where name = 'Compte courant'")).rows[0].id;
        const category = (await q("select id from public.categories where name = 'Logement'")).rows[0].id;
        const rule = await q(
          "insert into public.recurring_transactions (account_id, category_id, type, amount_cents, description, frequency, next_occurrence, anchor_day) values ($1, $2, 'expense', 65000, 'Loyer', 'monthly', '2026-01-31', 31) returning id",
          [account, category],
        );
        const first = (await q("select public.materialize_recurring_transactions('2026-04-30') as n")).rows[0].n;
        const again = (await q("select public.materialize_recurring_transactions('2026-04-30') as n")).rows[0].n;
        const dates = await q("select to_char(transaction_date, 'YYYY-MM-DD') as d from public.transactions where recurrence_id = $1 order by 1", [rule.rows[0].id]);
        const next = await q("select to_char(next_occurrence, 'YYYY-MM-DD') as d from public.recurring_transactions where id = $1", [rule.rows[0].id]);
        return { first, again, dates: dates.rows.map((r) => r.d), next: next.rows[0].d };
      });
      expect(result).toEqual({ first: 4, again: 0, dates: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"], next: "2026-05-31" });
    });

    it("la génération des récurrences ne touche jamais les règles d'un autre utilisateur", async () => {
      await commitAs(db, alice, async (q) => {
        const account = (await q("select id from public.accounts where name = 'Compte courant'")).rows[0].id;
        const category = (await q("select id from public.categories where name = 'Abonnements'")).rows[0].id;
        await q(
          "insert into public.recurring_transactions (account_id, category_id, type, amount_cents, description, frequency, next_occurrence) values ($1, $2, 'expense', 1799, 'Netflix', 'monthly', '2026-09-20')",
          [account, category],
        );
      });
      const generatedByBob = await as(db, bob, async (q) => (await q("select public.materialize_recurring_transactions('2026-12-31') as n")).rows[0].n);
      expect(generatedByBob).toBe(0);
    });

    it("refuse les montants nuls ou négatifs et les incohérences de type", async () => {
      const account = await accountId(alice);
      const courses = await categoryId(alice, "Courses");
      await expect(
        as(db, alice, (q) => q("insert into public.transactions (account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, 'expense', 0, '2026-09-01')", [account, courses])),
      ).rejects.toThrow(/check constraint/);
      await expect(
        as(db, alice, (q) =>
          q("insert into public.transactions (account_id, category_id, goal_id, type, amount_cents, transaction_date) values ($1, $2, $3, 'expense', 100, '2026-09-01')", [
            account,
            courses,
            aliceGoal,
          ]),
        ),
      ).rejects.toThrow(/check constraint/);
    });
  });

  describe("sécurité des migrations", () => {
    it("échoue au lieu de se mélanger si les tables existent déjà (mauvaise base ciblée)", async () => {
      const schema = readFileSync(migrationFiles()[0], "utf8");
      await db.query("begin");
      await expect(db.query(schema)).rejects.toThrow(/already exists/);
      await db.query("rollback");
    });
  });
});
