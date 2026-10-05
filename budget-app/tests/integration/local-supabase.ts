/**
 * Accès à une pile Supabase LOCALE pour les tests (supabase start, ou équivalent).
 * Refuse toute adresse distante : aucun compte de test n'est jamais créé sur un vrai projet.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const localUrl = process.env.E2E_SUPABASE_URL;
export const localAnonKey = process.env.E2E_SUPABASE_ANON_KEY;

export function assertLocal(url: string | undefined): string {
  if (!url) throw new Error("E2E_SUPABASE_URL manquant");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refus : les tests ne s'exécutent que contre une pile Supabase locale (reçu « ${host} »).`);
  }
  return url;
}

export function anonymousClient(): SupabaseClient {
  return createClient(assertLocal(localUrl), localAnonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;

/** Crée un compte (confirmation automatique sur la pile locale) et renvoie un client connecté. */
export async function signedInClient(prefix: string, displayName?: string): Promise<{ client: SupabaseClient; email: string; userId: string }> {
  const client = anonymousClient();
  const email = uniqueEmail(prefix);
  const { data, error } = await client.auth.signUp({ email, password: "motdepasse-solide", options: { data: { display_name: displayName ?? "" } } });
  if (error || !data.session || !data.user) throw new Error(`Inscription impossible : ${error?.message ?? "pas de session (confirmation e-mail activée ?)"}`);
  return { client, email, userId: data.user.id };
}
