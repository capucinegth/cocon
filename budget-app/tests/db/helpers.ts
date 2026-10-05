/**
 * Aide aux tests de base de données : une base PostgreSQL vierge par fichier de test,
 * avec le shim Supabase local puis les VRAIES migrations du dossier supabase/migrations.
 *
 * Nécessite un serveur PostgreSQL local : TEST_DATABASE_URL (ex. postgres://postgres@localhost:54329/postgres).
 * Sans cette variable, les tests de base sont ignorés (ils ne sont jamais lancés contre Supabase).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export const adminUrl = process.env.TEST_DATABASE_URL;

const root = fileURLToPath(new URL("../..", import.meta.url));
const migrationsDir = join(root, "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => join(migrationsDir, file));
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Crée une base vierge, applique shim + migrations, renvoie un client superutilisateur. */
export async function createTestDatabase(prefix: string): Promise<{ db: Client; drop: () => Promise<void> }> {
  if (!adminUrl) throw new Error("TEST_DATABASE_URL manquant");
  const host = new URL(adminUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1", ""].includes(host)) {
    throw new Error(`Refus : les tests de base ne s'exécutent que sur un serveur local (reçu « ${host} »).`);
  }
  const name = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);

  const db = new Client({ connectionString: withDatabase(adminUrl, name) });
  await db.connect();
  await db.query(readFileSync(join(root, "supabase", "tests", "support", "local-auth-shim.sql"), "utf8"));
  for (const file of migrationFiles()) {
    await db.query(readFileSync(file, "utf8"));
  }

  return {
    db,
    drop: async () => {
      await db.end();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}

/** Inscrit un utilisateur (comme le ferait Supabase Auth) : déclenche la préparation du compte. */
export async function createUser(db: Client, email: string, displayName?: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(displayName ? { display_name: displayName } : {})],
  );
  return rows[0].id;
}

/**
 * Exécute des requêtes avec l'identité d'un utilisateur connecté, exactement comme PostgREST :
 * rôle `authenticated` + claims JWT dans `request.jwt.claims`. Tout est annulé à la fin.
 * Passer `null` simule un visiteur non connecté (rôle `anon`).
 */
export async function as<T>(db: Client, userId: string | null, fn: (q: Client["query"]) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (userId) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    } else {
      await db.query("set local role anon");
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
    }
    const result = await fn(db.query.bind(db) as Client["query"]);
    await db.query("rollback");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

/** Comme `as`, mais valide la transaction (pour préparer des données vues ensuite par un autre utilisateur). */
export async function commitAs<T>(db: Client, userId: string, fn: (q: Client["query"]) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
    const result = await fn(db.query.bind(db) as Client["query"]);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
