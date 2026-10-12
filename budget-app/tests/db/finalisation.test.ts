/**
 * Écritures ajoutées par la finalisation du cœur, vérifiées sur un vrai PostgreSQL local
 * (vraies migrations, vraies politiques RLS, mêmes requêtes que le dépôt Supabase) :
 * comptes (nom, solde de départ, actif, ordre), récurrences (fréquence, ancrage, catégorie, compte),
 * restauration d'une catégorie archivée. Aucune migration nouvelle n'est nécessaire.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, as, commitAs, createTestDatabase, createUser } from "./helpers";

const suite = adminUrl ? describe : describe.skip;

suite("Base Cocon — comptes, récurrences et catégories (finalisation)", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;
  let ruleId: string;

  const id = async (table: "accounts" | "categories", userId: string, name: string) =>
    (await db.query(`select id from public.${table} where user_id = $1 and name = $2`, [userId, name])).rows[0].id as string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_final"));
    alice = await createUser(db, "alice@example.com", "Alice");
    bob = await createUser(db, "bob@example.com");
    const courant = await id("accounts", alice, "Compte courant");
    const abonnements = await id("categories", alice, "Abonnements");
    ruleId = await commitAs(db, alice, async (q) => {
      const { rows } = await q(
        "insert into public.recurring_transactions (account_id, category_id, type, amount_cents, description, frequency, next_occurrence, anchor_day) values ($1, $2, 'expense', 1799, 'Netflix', 'monthly', '2026-10-20', 20) returning id",
        [courant, abonnements],
      );
      return rows[0].id as string;
    });
  });

  afterAll(async () => {
    await drop?.();
  });

  describe("comptes", () => {
    it("l'utilisatrice modifie nom, solde de départ, état et ordre de ses comptes", async () => {
      const especes = await id("accounts", alice, "Espèces");
      const livret = await id("accounts", alice, "Livret A");
      const rows = await as(db, alice, async (q) => {
        await q("update public.accounts set name = 'Porte-monnaie', initial_balance_cents = -1250, is_active = false where id = $1", [especes]);
        await q("update public.accounts set sort_order = 10 where id = $1", [livret]);
        return (await q("select name, initial_balance_cents::int as initial, is_active, sort_order from public.accounts order by sort_order, name")).rows;
      });
      expect(rows).toEqual([
        { name: "Compte courant", initial: 0, is_active: true, sort_order: 10 },
        { name: "Livret A", initial: 0, is_active: true, sort_order: 10 },
        { name: "Porte-monnaie", initial: -1250, is_active: false, sort_order: 20 },
      ]);
    });

    it("impossible de modifier les comptes d'une autre utilisatrice (0 ligne touchée)", async () => {
      const bobAccount = await id("accounts", bob, "Compte courant");
      const updated = await as(db, alice, async (q) => (await q("update public.accounts set name = 'Piraté' where id = $1 returning id", [bobAccount])).rowCount);
      expect(updated).toBe(0);
    });

    it("impossible de transférer un compte à quelqu'un d'autre", async () => {
      const courant = await id("accounts", alice, "Compte courant");
      await expect(as(db, alice, (q) => q("update public.accounts set user_id = $1 where id = $2", [bob, courant]))).rejects.toThrow(/row-level security/);
    });

    it("un compte désactivé garde ses opérations", async () => {
      const especes = await id("accounts", alice, "Espèces");
      const courses = await id("categories", alice, "Courses");
      const count = await as(db, alice, async (q) => {
        await q("insert into public.transactions (account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, 'expense', 2000, '2026-09-02')", [especes, courses]);
        await q("update public.accounts set is_active = false where id = $1", [especes]);
        return (await q("select count(*)::int as n from public.transactions where account_id = $1", [especes])).rows[0].n;
      });
      expect(count).toBe(1);
    });
  });

  describe("récurrences", () => {
    it("fréquence, ancrage, échéance, catégorie et compte modifiables par l'utilisatrice", async () => {
      const loisirs = await id("categories", alice, "Loisirs");
      const livret = await id("accounts", alice, "Livret A");
      const row = await as(db, alice, async (q) => {
        await q(
          "update public.recurring_transactions set frequency = 'weekly', anchor_day = null, next_occurrence = '2026-09-22', category_id = $1, account_id = $2 where id = $3",
          [loisirs, livret, ruleId],
        );
        return (await q("select frequency, anchor_day, next_occurrence::text as next from public.recurring_transactions where id = $1", [ruleId])).rows[0];
      });
      expect(row).toEqual({ frequency: "weekly", anchor_day: null, next: "2026-09-22" });
    });

    it("refuse une catégorie ou un compte d'une autre utilisatrice", async () => {
      const bobCategory = await id("categories", bob, "Loisirs");
      await expect(as(db, alice, (q) => q("update public.recurring_transactions set category_id = $1 where id = $2", [bobCategory, ruleId]))).rejects.toThrow(
        /foreign key/,
      );
    });

    it("reprise après une pause : la génération ne crée que les échéances à partir de la date choisie", async () => {
      const created = await as(db, alice, async (q) => {
        // Pause depuis février, reprise en juin à la prochaine échéance (calculée par l'application).
        await q("update public.recurring_transactions set is_active = false, next_occurrence = '2026-02-20' where id = $1", [ruleId]);
        await q("update public.recurring_transactions set is_active = true, next_occurrence = '2026-06-20' where id = $1", [ruleId]);
        await q("select public.materialize_recurring_transactions('2026-06-25')");
        return (await q("select transaction_date::text as d from public.transactions where recurrence_id = $1 order by 1", [ruleId])).rows.map((r) => r.d);
      });
      expect(created).toEqual(["2026-06-20"]);
    });
  });

  describe("catégories", () => {
    it("archiver puis restaurer une catégorie", async () => {
      const shopping = await id("categories", alice, "Shopping");
      const archivedAt = await as(db, alice, async (q) => {
        await q("update public.categories set archived_at = now() where id = $1", [shopping]);
        await q("update public.categories set archived_at = null where id = $1", [shopping]);
        return (await q("select archived_at from public.categories where id = $1", [shopping])).rows[0].archived_at;
      });
      expect(archivedAt).toBeNull();
    });

    it("restauration refusée si une catégorie active porte déjà ce nom", async () => {
      const shopping = await id("categories", alice, "Shopping");
      await expect(
        as(db, alice, async (q) => {
          await q("update public.categories set archived_at = now() where id = $1", [shopping]);
          await q("insert into public.categories (name, type) values ('shopping', 'variable')");
          await q("update public.categories set archived_at = null where id = $1", [shopping]);
        }),
      ).rejects.toThrow(/duplicate key/);
    });

    it("catégorie de revenu créée par l'utilisatrice", async () => {
      const type = await as(db, alice, async (q) => (await q("insert into public.categories (name, type) values ('Allocations', 'income') returning type")).rows[0].type);
      expect(type).toBe("income");
    });
  });
});
