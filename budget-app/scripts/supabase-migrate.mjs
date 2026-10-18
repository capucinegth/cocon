#!/usr/bin/env node
/**
 * Applique les migrations de Cocon sur un projet Supabase HÉBERGÉ, avec garde-fous.
 *
 *   node scripts/supabase-migrate.mjs --project "<nom exact du projet>"            # vérification seule (rien n'est modifié)
 *   node scripts/supabase-migrate.mjs --project "<nom exact du projet>" --apply    # application
 *
 * Le nom du projet Supabase de Cocon n'est écrit nulle part dans le dépôt : il est fourni au
 * moment de la connexion, avec --project ou la variable SUPABASE_PROJECT_NAME (si les deux sont
 * donnés, ils doivent être identiques).
 *
 * Variables : SUPABASE_ACCESS_TOKEN (jeton personnel Supabase, jamais affiché ni écrit),
 * SUPABASE_PROJECT_NAME (facultative, à la place de --project),
 * NEXT_PUBLIC_SUPABASE_URL (facultative : si présente, elle doit désigner le même projet).
 * Derrière un proxy HTTPS, lancer avec NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
 *
 * Garde-fous — tout s'arrête au moindre doute :
 *   1. le projet est retrouvé par son NOM exact, une seule correspondance, et doit être actif ;
 *   2. l'URL de l'application (si définie) doit pointer vers ce même projet ;
 *   3. le schéma public doit être vide (ni table, ni vue, ni fonction), sans compte utilisateur
 *      ni déclencheur sur les inscriptions : jamais de mélange avec une autre application ;
 *   4. sans --apply, rien n'est modifié ;
 *   5. les migrations s'appliquent en une seule transaction : tout ou rien, jamais un état
 *      intermédiaire (par exemple des tables créées sans leur RLS).
 * Les migrations de Cocon sont uniquement additives (aucun DROP, DELETE ni TRUNCATE).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Surcharge réservée aux tests du script (API simulée sur une base locale).
const API = process.env.SUPABASE_API_URL ?? "https://api.supabase.com/v1";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const COCON_TABLES = [
  "accounts",
  "budget_categories",
  "budgets",
  "categories",
  "document_deadlines",
  "document_fields",
  "document_folders",
  "documents",
  "profiles",
  "recurring_transactions",
  "savings_goals",
  "transactions",
];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const flagIndex = args.indexOf("--project");
const projectFromFlag = flagIndex >= 0 ? args[flagIndex + 1] : undefined;
const projectFromEnv = process.env.SUPABASE_PROJECT_NAME?.trim() || undefined;
const token = process.env.SUPABASE_ACCESS_TOKEN;

function stop(message) {
  console.error(`\n✋ Arrêt : ${message}`);
  process.exit(1);
}

if (flagIndex >= 0 && (!projectFromFlag || projectFromFlag.startsWith("--"))) stop("--project doit être suivi du nom exact du projet.");
if (projectFromFlag && projectFromEnv && projectFromFlag !== projectFromEnv) {
  stop(`--project (« ${projectFromFlag} ») et SUPABASE_PROJECT_NAME (« ${projectFromEnv} ») désignent deux projets différents.`);
}
const projectName = projectFromFlag ?? projectFromEnv;
if (!projectName) stop("indique le nom exact du projet Supabase de Cocon : --project <nom> ou SUPABASE_PROJECT_NAME.");
if (/[<>]/.test(projectName)) stop("remplace le texte d'exemple par le nom exact du projet, tel qu'affiché dans le tableau de bord Supabase.");
if (!token) stop("SUPABASE_ACCESS_TOKEN manquant (à définir dans les réglages de l'environnement, jamais dans le code).");

async function api(path, init = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    stop(`Supabase injoignable (${error.cause?.code ?? error.message}). Vérifie l'accès réseau à api.supabase.com (et NODE_USE_ENV_PROXY=1 derrière un proxy).`);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status === 401) stop("jeton Supabase refusé (invalide ou révoqué).");
  if (!response.ok) stop(`l'API Supabase a répondu ${response.status} : ${body?.message ?? text.slice(0, 300)}`);
  return body;
}

const sql = (ref, query) => api(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query }) });

// 1. Le bon projet, et lui seul.
const projects = await api("/projects");
const matches = projects.filter((p) => p.name === projectName);
if (matches.length === 0) stop(`aucun projet nommé « ${projectName} ». Projets visibles : ${projects.map((p) => p.name).join(", ") || "aucun"}.`);
if (matches.length > 1) stop(`plusieurs projets s'appellent « ${projectName} » : impossible de choisir sans risque.`);
const project = matches[0];
const ref = project.ref ?? project.id;
console.log(`Projet : ${project.name} · réf. ${ref} · région ${project.region} · état ${project.status}`);
if (project.status !== "ACTIVE_HEALTHY") stop(`le projet n'est pas actif (${project.status}).`);

// 2. L'application vise-t-elle le même projet ?
const appUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (appUrl) {
  const host = new URL(appUrl).hostname;
  if (!host.startsWith(`${ref}.`)) stop(`NEXT_PUBLIC_SUPABASE_URL (${host}) ne correspond pas au projet ${ref}.`);
  console.log(`URL de l'application : cohérente (${host}).`);
}

// 3. Schéma public vide ?
const existing = await sql(
  ref,
  `select 'table' as kind, table_name as name from information_schema.tables where table_schema = 'public'
   union all
   select 'fonction', p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
   order by 1, 2`,
);
const coconAlready = existing.filter((row) => row.kind === "table" && COCON_TABLES.includes(row.name));
if (coconAlready.length === COCON_TABLES.length) stop("les tables de Cocon existent déjà : migrations probablement déjà appliquées. Rien n'est fait.");
if (existing.length > 0) {
  stop(`le schéma public n'est pas vide (${existing.map((row) => `${row.kind} ${row.name}`).join(", ")}). Ce projet sert peut-être à autre chose : rien n'est appliqué.`);
}
console.log("Schéma public : vide.");

// Comptes et déclencheurs existants : une autre application partagerait les inscriptions de Cocon.
const [{ users }] = await sql(ref, "select count(*)::int as users from auth.users");
const triggers = await sql(ref, "select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal order by 1");
if (users > 0) stop(`le projet a déjà ${users} compte(s) utilisateur : ils pourraient se connecter à Cocon. Confirme d'abord que ce sont bien des comptes de test à garder.`);
if (triggers.length > 0) stop(`des déclencheurs existent déjà sur les inscriptions (${triggers.map((t) => t.tgname).join(", ")}) : une autre application utilise ce projet.`);
console.log("Comptes utilisateurs : aucun · déclencheurs sur les inscriptions : aucun.");

const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
console.log(`\nMigrations à appliquer, dans l'ordre :\n${files.map((file) => `  • ${file}`).join("\n")}`);

if (!apply) {
  console.log("\nSimulation uniquement : rien n'a été modifié. Relancer avec --apply pour appliquer.");
  process.exit(0);
}

// 4–5. Application en UNE seule transaction : tout ou rien (jamais de tables sans leur RLS).
process.stdout.write("\nApplication des migrations (transaction unique)… ");
const script = files.map((file) => `-- ${file}\n${readFileSync(join(migrationsDir, file), "utf8")}`).join("\n");
await sql(ref, `begin;\n${script}\ncommit;`);
process.stdout.write("ok");

// Contrôles après application.
const rls = await sql(
  ref,
  `select c.relname as name, c.relrowsecurity as rls, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by 1`,
);
const anonGrants = await sql(ref, `select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`);
const truncate = await sql(
  ref,
  `select table_name from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'TRUNCATE'`,
);
const trigger = await sql(ref, `select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'`);

console.log("\n\nContrôles :");
rls.forEach((row) => console.log(`  ${row.rls ? "✓" : "✗"} ${row.name} : RLS ${row.rls ? "activée" : "DÉSACTIVÉE"}, ${row.policies} politiques`));
console.log(`  ${anonGrants.length === 0 ? "✓" : "✗"} visiteur non connecté (anon) : ${anonGrants.length === 0 ? "aucun droit" : JSON.stringify(anonGrants)}`);
console.log(`  ${truncate.length === 0 ? "✓" : "✗"} TRUNCATE retiré aux utilisateurs connectés`);
console.log(`  ${trigger.length === 1 ? "✓" : "✗"} préparation du compte à l'inscription (trigger)`);
const ok = rls.length === COCON_TABLES.length && rls.every((row) => row.rls && Number(row.policies) > 0) && anonGrants.length === 0 && truncate.length === 0 && trigger.length === 1;
if (!ok) stop("un contrôle a échoué : vérifier avant toute utilisation.");
console.log("\nMigrations appliquées et vérifiées.");
