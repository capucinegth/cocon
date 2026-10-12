/**
 * Migration 20261012090000 (transferts d'épargne, récurrences sur compte désactivé),
 * vérifiée sur un vrai PostgreSQL local : compatibilité avec les données existantes,
 * contraintes, RLS et génération des récurrences.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminUrl, as, commitAs, createTestDatabase, createUser, migrationFiles } from "./helpers";

const suite = adminUrl ? describe : describe.skip;
const MIGRATION = "20261012090000_cocon_transferts_epargne.sql";
const root = fileURLToPath(new URL("../..", import.meta.url));

suite("Migration transferts — données existantes préservées", () => {
  it("appliquée sur une base qui contient déjà des données : aucune ligne modifiée ni supprimée", async () => {
    const name = `cocon_upgrade_${Date.now().toString(36)}`;
    const admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${name}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${name}`;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(readFileSync(join(root, "supabase", "tests", "support", "local-auth-shim.sql"), "utf8"));
      const before = migrationFiles().filter((file) => !file.endsWith(MIGRATION));
      for (const file of before) await db.query(readFileSync(file, "utf8"));

      // Données « de production » d'avant la migration.
      const alice = await createUser(db, "alice@example.com", "Alice");
      const ids = async (table: string, name: string) =>
        (await db.query(`select id from public.${table} where user_id = $1 and name = $2`, [alice, name])).rows[0].id as string;
      const courant = await ids("accounts", "Compte courant");
      const epargne = await ids("categories", "Épargne");
      const courses = await ids("categories", "Courses");
      await commitAs(db, alice, async (q) => {
        await q("insert into public.transactions (account_id, category_id, type, amount_cents, transaction_date, note) values ($1, $2, 'saving', 30000, '2026-09-12', 'ancienne épargne')", [courant, epargne]);
        await q("insert into public.transactions (account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, 'expense', 4250, '2026-09-13')", [courant, courses]);
        await q("insert into public.recurring_transactions (account_id, category_id, type, amount_cents, description, frequency, next_occurrence, anchor_day) values ($1, $2, 'saving', 30000, 'Virement épargne', 'monthly', '2026-10-12', 12)", [courant, epargne]);
      });
      const snapshot = async () => ({
        transactions: (await db.query("select id, account_id, category_id, type, amount_cents::int, transaction_date::text, note from public.transactions order by id")).rows,
        recurring: (await db.query("select id, account_id, type, amount_cents::int, next_occurrence::text, is_active from public.recurring_transactions order by id")).rows,
        accounts: (await db.query("select id, name, initial_balance_cents::int, is_active, sort_order from public.accounts order by id")).rows,
        categories: (await db.query("select count(*)::int as n from public.categories")).rows,
      });
      const beforeData = await snapshot();

      await db.query(readFileSync(migrationFiles().find((file) => file.endsWith(MIGRATION))!, "utf8"));

      expect(await snapshot()).toEqual(beforeData);
      const legacy = await db.query("select count(*)::int as n from public.transactions where transfer_account_id is null");
      expect(legacy.rows[0].n).toBe(2);
      // L'ancienne règle d'épargne (sans destination) continue de fonctionner.
      const generated = await as(db, alice, async (q) => (await q("select public.materialize_recurring_transactions('2026-10-12') as n")).rows[0].n);
      expect(generated).toBe(1);
    } finally {
      await db.end();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    }
  });
});

suite("Transferts d'épargne et récurrences — contraintes, RLS, génération", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;
  const id = async (table: "accounts" | "categories", userId: string, name: string) =>
    (await db.query(`select id from public.${table} where user_id = $1 and name = $2`, [userId, name])).rows[0].id as string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_transferts"));
    alice = await createUser(db, "alice@example.com");
    bob = await createUser(db, "bob@example.com");
  });
  afterAll(async () => {
    await drop?.();
  });

  const insertSaving = (q: Client["query"], from: string, to: string | null, category: string) =>
    q(
      "insert into public.transactions (account_id, transfer_account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, $3, 'saving', 10000, '2026-09-10') returning id",
      [from, to, category],
    );

  it("transfert compte courant → Livret A accepté, et relu", async () => {
    const [courant, livret, epargne] = [await id("accounts", alice, "Compte courant"), await id("accounts", alice, "Livret A"), await id("categories", alice, "Épargne")];
    const row = await as(db, alice, async (q) => {
      await insertSaving(q, courant, livret, epargne);
      return (await q("select account_id, transfer_account_id, amount_cents::int from public.transactions")).rows[0];
    });
    expect(row).toEqual({ account_id: courant, transfer_account_id: livret, amount_cents: 10000 });
  });

  it("interdits : depuis un compte d'épargne, vers un compte hors épargne, même compte, autre type d'opération", async () => {
    const [courant, especes, livret, epargne, courses] = [
      await id("accounts", alice, "Compte courant"),
      await id("accounts", alice, "Espèces"),
      await id("accounts", alice, "Livret A"),
      await id("categories", alice, "Épargne"),
      await id("categories", alice, "Courses"),
    ];
    // Même compte : refusé (par le contrôle du sens du transfert, avant même la contrainte transactions_transfer_check).
    await expect(as(db, alice, (q) => insertSaving(q, livret, livret, epargne))).rejects.toThrow(/hors épargne|transactions_transfer_check/);
    await expect(as(db, alice, (q) => insertSaving(q, courant, courant, epargne))).rejects.toThrow(/compte d'épargne|transactions_transfer_check/);
    await expect(as(db, alice, (q) => insertSaving(q, courant, especes, epargne))).rejects.toThrow(/compte d'épargne/);
    const otherLivret = await db.query("insert into public.accounts (user_id, name, type) values ($1, 'Livret 2', 'savings') returning id", [alice]);
    await expect(as(db, alice, (q) => insertSaving(q, livret, otherLivret.rows[0].id, epargne))).rejects.toThrow(/hors épargne/);
    await expect(
      as(db, alice, (q) =>
        q("insert into public.transactions (account_id, transfer_account_id, category_id, type, amount_cents, transaction_date) values ($1, $2, $3, 'expense', 100, '2026-09-10')", [courant, livret, courses]),
      ),
    ).rejects.toThrow(/transactions_transfer_check/);
    await db.query("delete from public.accounts where id = $1", [otherLivret.rows[0].id]);
  });

  it("impossible de viser le compte d'une autre utilisatrice ; transferts invisibles pour les autres", async () => {
    const [courant, epargne] = [await id("accounts", alice, "Compte courant"), await id("categories", alice, "Épargne")];
    const bobLivret = await id("accounts", bob, "Livret A");
    await expect(as(db, alice, (q) => insertSaving(q, courant, bobLivret, epargne))).rejects.toThrow(/foreign key|compte d'épargne/);
    const livret = await id("accounts", alice, "Livret A");
    await commitAs(db, alice, (q) => insertSaving(q, courant, livret, epargne));
    const seen = await as(db, bob, async (q) => (await q("select count(*)::int as n from public.transactions")).rows[0].n);
    expect(seen).toBe(0);
  });

  it("récurrence d'épargne : la destination est recopiée dans les opérations générées", async () => {
    const [courant, livret, epargne] = [await id("accounts", alice, "Compte courant"), await id("accounts", alice, "Livret A"), await id("categories", alice, "Épargne")];
    const rows = await as(db, alice, async (q) => {
      await q(
        "insert into public.recurring_transactions (account_id, transfer_account_id, category_id, type, amount_cents, frequency, next_occurrence, anchor_day) values ($1, $2, $3, 'saving', 5000, 'monthly', '2026-08-05', 5)",
        [courant, livret, epargne],
      );
      await q("select public.materialize_recurring_transactions('2026-09-06')");
      return (await q("select transaction_date::text as d, transfer_account_id from public.transactions where recurrence_id is not null order by 1")).rows;
    });
    expect(rows).toEqual([
      { d: "2026-08-05", transfer_account_id: livret },
      { d: "2026-09-05", transfer_account_id: livret },
    ]);
  });

  it("aucune opération générée sur un compte désactivé (source ou destination), sans rattrapage ensuite", async () => {
    const [courant, livret, epargne, abonnements] = [
      await id("accounts", alice, "Compte courant"),
      await id("accounts", alice, "Livret A"),
      await id("categories", alice, "Épargne"),
      await id("categories", alice, "Abonnements"),
    ];
    const result = await as(db, alice, async (q) => {
      const a = await q(
        "insert into public.recurring_transactions (account_id, category_id, type, amount_cents, frequency, next_occurrence, anchor_day) values ($1, $2, 'expense', 1799, 'monthly', '2026-08-20', 20) returning id",
        [courant, abonnements],
      );
      const b = await q(
        "insert into public.recurring_transactions (account_id, transfer_account_id, category_id, type, amount_cents, frequency, next_occurrence, anchor_day) values ($1, $2, $3, 'saving', 5000, 'monthly', '2026-08-25', 25) returning id",
        [courant, livret, epargne],
      );
      await q("update public.accounts set is_active = false where id = $1", [livret]);
      // Courant reste actif : seule la règle vers le Livret A désactivé est ignorée.
      await q("select public.materialize_recurring_transactions('2026-09-30')");
      const count = async (rule: string) => (await q("select count(*)::int as n from public.transactions where recurrence_id = $1", [rule])).rows[0].n;
      const next = async (rule: string) => (await q("select next_occurrence::text as d from public.recurring_transactions where id = $1", [rule])).rows[0].d;
      return { expense: await count(a.rows[0].id), saving: await count(b.rows[0].id), savingNext: await next(b.rows[0].id) };
    });
    expect(result).toEqual({ expense: 2, saving: 0, savingNext: "2026-08-25" });
  });

  it("droits : la fonction de contrôle n'est pas appelable via l'API ; génération réservée aux connectés", async () => {
    const rows = (
      await db.query(
        "select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth, has_function_privilege('anon', p.oid, 'EXECUTE') as anon from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('check_transfer_accounts', 'materialize_recurring_transactions') order by 1",
      )
    ).rows;
    expect(rows).toEqual([
      { proname: "check_transfer_accounts", auth: false, anon: false },
      { proname: "materialize_recurring_transactions", auth: true, anon: false },
    ]);
  });
});
