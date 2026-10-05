import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Client Supabase côté serveur (route handlers, composants serveur). */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  if (!supabaseEnv) throw new Error("Supabase n'est pas configuré (mode démo).");
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url, supabaseEnv.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur : le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}
