import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Montant de la carte principale (« Il te reste »). */
export async function heroAmount(page: Page): Promise<string> {
  return clean(await page.locator("section[aria-labelledby='hero-title'] p[aria-live]").first().innerText());
}

export const sheet = (page: Page) => page.locator("dialog[open]");

const navTargets = {
  "/": /^Accueil$/,
  "/budget": /^Budget$/,
  "/transactions": /^(Transactions|Opérations)$/,
  "/objectifs": /^Objectifs$/,
  "/statistiques": /^(Statistiques|Stats)$/,
  "/parametres": /^Paramètres$/,
} as const;

/**
 * Navigation par les liens de l'application (sans rechargement), comme un utilisateur.
 * Indispensable en démo : un rechargement complet repart des données d'exemple.
 */
export async function navigate(page: Page, path: keyof typeof navTargets) {
  await page.getByRole("link", { name: navTargets[path] }).filter({ visible: true }).first().click();
  await page.waitForURL((url) => url.pathname === path);
}

/** Ouvre l'ajout rapide (barre latérale ou bouton flottant). */
export async function openAdd(page: Page) {
  await page.getByRole("button", { name: "Ajouter", exact: true }).first().click();
  await expect(sheet(page)).toBeVisible();
}

/** Saisit une opération dans la feuille d'ajout. */
export async function fillOperation(
  page: Page,
  { amount, label, category, kind, recurrence, date }: { amount: string; label?: string; category?: RegExp; kind?: "Dépense" | "Revenu" | "Épargne"; recurrence?: string; date?: string },
) {
  const dialog = sheet(page);
  if (kind) await dialog.getByRole("radio", { name: kind }).click();
  await dialog.getByLabel("Montant en euros").fill(amount);
  if (label) await dialog.getByLabel(/Description/).fill(label);
  if (category) await dialog.getByRole("button", { name: category }).first().click();
  if (date) {
    await dialog.getByRole("button", { name: "Autre date" }).click();
    await dialog.getByLabel("Choisir une date").fill(date);
  }
  if (recurrence) await dialog.getByRole("button", { name: recurrence }).click();
}

/** Audit d'accessibilité automatique (axe-core, règles WCAG 2.1 A/AA). */
export async function expectNoA11yViolations(page: Page) {
  // Contrastes mesurés une fois les apparitions (fondus, transitions) terminées.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
      .every((animation) => animation.playState !== "running"),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.nodes.length}) : ${v.nodes.map((node) => `${node.target.join(" ")} — ${clean(node.failureSummary ?? "")}`).join(" | ")}`,
  );
  expect(summary).toEqual([]);
}

/** Aucune barre de défilement horizontale (mise en page qui déborde). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
