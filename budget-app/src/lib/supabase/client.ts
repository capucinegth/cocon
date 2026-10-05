"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** Client Supabase du navigateur (session dans les cookies, partagée avec le serveur). */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!supabaseEnv) throw new Error("Supabase n'est pas configuré (mode démo).");
  client ??= createBrowserClient(supabaseEnv.url, supabaseEnv.key);
  return client;
}
