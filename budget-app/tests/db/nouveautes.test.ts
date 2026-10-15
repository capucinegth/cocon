/**
 * Nouveaux comptes et charges fixes, sur un vrai PostgreSQL local (vraies migrations, vraies RLS),
 * avec exactement les lignes envoyées par le dépôt Supabase. Aucune migration nouvelle n'est nécessaire.
 */
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newAccountToRow, recurringToRow } from "@/services/mappers";
import { buildAccount, buildFixedCharge } from "@/store/budget-state";
import { adminUrl, as, createTestDatabase, createUser } from "./helpers";

const suite = adminUrl ? describe : describe.skip;

/** INSERT paramétré à partir d'une ligne du dépôt (mêmes colonnes que PostgREST). */
function insert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  return {
    text: `insert into public.${table} (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    values: Object.values(row),
  };
}

suite("Base Cocon — créer un compte, ajouter une charge fixe", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string;
  let bob: string;

  const id = async (table: "accounts" | "categories", userId: string, name: string) =>
    (await db.query(`select id from public.${table} where user_id = $1 and name = $2`, [userId, name])).rows[0].id as string;

  beforeAll(async () => {
    ({ db, drop } = await createTestDatabase("cocon_nouveautes"));
    alice = await createUser(db, "alice@example.com", "Alice");
    bob = await createUser(db, "bob@example.com");
  });

  afterAll(async () => {
    await drop?.();
  });

  it("l'utilisatrice crée un compte : il lui appartient (user_id donné par la base)", async () => {
    const account = buildAccount({ label: "Boursorama", type: "checking", initialBalance: 120.5 }, randomUUID);
    const { text, values } = insert("accounts", newAccountToRow(account, 40));
    const row = await as(db, alice, async (q) => (await q(text, values)).rows[0]);
    expect(row).toMatchObject({ id: account.id, user_id: alice, name: "Boursorama", type: "checking", sort_order: 40, is_active: true });
    expect(Number(row.initial_balance_cents)).toBe(12050);
  });

  it("impossible de créer un compte au nom d'une autre utilisatrice, ou sans être connectée", async () => {
    const account = buildAccount({ label: "Intrus", type: "cash", initialBalance: 0 }, randomUUID);
    const { text, values } = insert("accounts", { ...newAccountToRow(account, 50), user_id: bob });
    await expect(as(db, alice, (q) => q(text, values))).rejects.toThrow(/row-level security/);
    const anon = insert("accounts", newAccountToRow(account, 50));
    await expect(as(db, null, (q) => q(anon.text, anon.values))).rejects.toThrow();
  });

  it("charge fixe sur un nouveau compte : règle seule, le prélèvement déjà passé n'est jamais généré", async () => {
    const today = "2026-09-13";
    const result = await as(db, alice, async (q) => {
      const account = buildAccount({ label: "Compte joint", type: "joint", initialBalance: 0 }, randomUUID);
      const a = insert("accounts", newAccountToRow(account, 40));
      await q(a.text, a.values);
      const logement = (await q("select id from public.categories where name = 'Logement'")).rows[0].id as string;
      // Le 5 est passé le 13 : premier prélèvement le 5 octobre.
      const rule = buildFixedCharge({ label: "Loyer", amount: 650, categoryId: logement, accountId: account.id, day: 5 }, today, randomUUID);
      const r = insert("recurring_transactions", recurringToRow(rule));
      const inserted = (await q(`${r.text.replace("returning *", "returning user_id, anchor_day, next_occurrence::text as next, type")}`, r.values)).rows[0];
      const count = async () => (await q("select count(*)::int as n from public.transactions where recurrence_id = $1", [rule.id])).rows[0].n as number;
      await q("select public.materialize_recurring_transactions($1)", [today]);
      const generatedToday = await count();
      await q("select public.materialize_recurring_transactions($1)", ["2026-10-05"]);
      const generatedOctober = await count();
      return { inserted, generatedToday, generatedOctober };
    });
    expect(result.inserted).toEqual({ user_id: alice, anchor_day: 5, next: "2026-10-05", type: "expense" });
    expect(result.generatedToday).toBe(0);
    expect(result.generatedOctober).toBe(1);
  });

  it("impossible de rattacher une charge fixe au compte d'une autre utilisatrice", async () => {
    const bobAccount = await id("accounts", bob, "Compte courant");
    const aliceCategory = await id("categories", alice, "Logement");
    const rule = buildFixedCharge({ label: "Loyer", amount: 650, categoryId: aliceCategory, accountId: bobAccount, day: 5 }, "2026-09-13", randomUUID);
    const { text, values } = insert("recurring_transactions", recurringToRow(rule));
    await expect(as(db, alice, (q) => q(text, values))).rejects.toThrow();
  });
});
