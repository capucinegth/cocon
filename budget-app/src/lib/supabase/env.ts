/**
 * Configuration Supabase, lue dans les variables d'environnement publiques
 * (jamais écrites dans le code). Sans configuration valide, Cocon reste en mode démo.
 *
 * Seule la clé PUBLIQUE (publishable / anon) peut être utilisée ici : elle est visible
 * dans le navigateur, et c'est la RLS qui protège les données. Une clé secrète
 * (service_role / sb_secret_…) est refusée.
 */

export type DataSource = "demo" | "supabase";

export interface SupabaseEnv {
  url: string;
  key: string;
}

/** Vrai si la clé donnée est une clé secrète, qui ne doit JAMAIS aller dans le navigateur. */
export function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.role === "service_role" || json?.role === "supabase_admin";
  } catch {
    return false;
  }
}

export function resolveSupabaseEnv(url: string | undefined, key: string | undefined): { env: SupabaseEnv | null; problem?: string } {
  if (!url && !key) return { env: null };
  if (!url || !key) return { env: null, problem: "Configuration Supabase incomplète : l'URL ou la clé publique manque." };
  if (isSecretKey(key)) {
    return { env: null, problem: "Clé Supabase refusée : c'est une clé secrète. Utilise uniquement la clé publique (publishable / anon)." };
  }
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return { env: null, problem: "URL Supabase invalide." };
  }
  return { env: { url: url.replace(/\/$/, ""), key } };
}

// Références explicites : Next.js remplace ces valeurs au moment de la compilation.
const resolved = resolveSupabaseEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabaseEnv: SupabaseEnv | null = resolved.env;
/** Problème de configuration à afficher (au lieu de basculer silencieusement en démo). */
export const supabaseConfigProblem: string | undefined = resolved.problem;

/**
 * Source des données. `NEXT_PUBLIC_COCON_DATA_SOURCE=demo` force la démo
 * (développement de l'interface), même si Supabase est configuré.
 */
export const dataSource: DataSource =
  process.env.NEXT_PUBLIC_COCON_DATA_SOURCE === "demo" || !supabaseEnv ? "demo" : "supabase";
