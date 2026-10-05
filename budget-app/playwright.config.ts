/**
 * Tests de bout en bout, dans un vrai navigateur, sur l'application compilée.
 *
 *   npm run test:e2e:demo      → mode démo (données fictives)
 *   npm run test:e2e:supabase  → mode Supabase, contre une pile LOCALE uniquement
 *                                (E2E_SUPABASE_URL + E2E_SUPABASE_ANON_KEY, ex. `supabase start`)
 *
 * Mobile (390 px) et ordinateur (1440 px), fuseau Europe/Paris, interface en français.
 */
import { defineConfig } from "@playwright/test";

// Permet d'intercepter aussi les requêtes du service worker (test de la page hors connexion).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= "1";

const mode = process.env.E2E_MODE === "supabase" ? "supabase" : "demo";
const port = mode === "supabase" ? 3100 : 3200;

function localSupabaseEnv(): Record<string, string> {
  const url = process.env.E2E_SUPABASE_URL ?? "";
  const key = process.env.E2E_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) throw new Error("E2E_SUPABASE_URL et E2E_SUPABASE_ANON_KEY sont requis pour les tests Supabase.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refus : les tests de bout en bout ne tournent que contre une pile Supabase locale (reçu « ${host} »).`);
  }
  return { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key };
}

const serverEnv = mode === "supabase" ? localSupabaseEnv() : { NEXT_PUBLIC_COCON_DATA_SOURCE: "demo" };

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: mode === "supabase" ? "supabase/**/*.spec.ts" : "demo/**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: mode === "supabase",
  workers: mode === "supabase" ? 3 : 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${port}`,
    url: `http://localhost:${port}/connexion`,
    reuseExistingServer: true,
    timeout: 240_000,
    env: serverEnv,
  },
});
