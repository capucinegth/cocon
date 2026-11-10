import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "motdepasse-solide";

export const uniqueEmail = (prefix: string) => `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;

/**
 * Inscription par l'interface (la pile locale confirme l'adresse automatiquement).
 * Le tuto de découverte s'ouvre à la première visite : il est passé (et retenu dans le profil),
 * sauf avec `keepTutorial`.
 */
export async function signUp(
  page: Page,
  { name, prefix = "e2e", keepTutorial = false }: { name?: string; prefix?: string; keepTutorial?: boolean } = {},
): Promise<string> {
  const email = uniqueEmail(prefix);
  await page.goto("/inscription");
  if (name) await page.getByLabel("Prénom (facultatif)").fill(name);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/inscription"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (!keepTutorial) await skipTutorial(page);
  return email;
}

/** Ferme le tuto de découverte et attend que « déjà vu » soit enregistré dans le profil. */
export async function skipTutorial(page: Page) {
  const tutorial = page.locator("dialog[open]").filter({ has: page.getByRole("heading", { name: "Découvrir Cocon" }) });
  await expect(tutorial).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/rest/v1/profiles") && response.request().method() === "PATCH"),
    tutorial.getByRole("button", { name: "Passer" }).click(),
  ]);
  await expect(tutorial).toHaveCount(0);
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

/** « Un autre appareil » : un navigateur vierge (aucun cookie, aucun stockage). */
export async function otherDevice(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await context.newPage();
  await logIn(page, email);
  return page;
}
