import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/** Montant de la carte principale (« Tu peux encore dépenser »). */
export async function heroAmount(page: Page): Promise<string> {
  return clean(await page.locator("section[aria-labelledby='hero-title'] p[aria-live]").first().innerText());
}

export const sheet = (page: Page) => page.locator("dialog[open]");

const navTargets = {
  "/": /^Accueil$/,
  "/budget": /^Budget$/,
  "/transactions": /^(Dépenses et revenus|Dépenses)$/,
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

/** Ouvre « Plus d'options » (description, note, date, répétition, compte) s'il est replié. */
export async function openMoreOptions(page: Page) {
  const toggle = sheet(page).getByRole("button", { name: "Plus d'options" });
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
}

/** Choisit une catégorie, en dépliant « Toutes les catégories » si elle n'est pas parmi les plus utilisées. */
export async function chooseCategory(page: Page, category: RegExp) {
  const dialog = sheet(page);
  if ((await dialog.getByRole("button", { name: category }).count()) === 0) {
    await dialog.getByRole("button", { name: /^Toutes les catégories/ }).click();
  }
  await dialog.getByRole("button", { name: category }).first().click();
}

/** Saisit une opération dans la feuille d'ajout. */
export async function fillOperation(
  page: Page,
  { amount, label, category, kind, recurrence, date }: { amount: string; label?: string; category?: RegExp; kind?: "Dépense" | "Revenu" | "Épargne"; recurrence?: string; date?: string },
) {
  const dialog = sheet(page);
  if (kind) await dialog.getByRole("radio", { name: kind }).click();
  await dialog.getByLabel("Montant en euros").fill(amount);
  if (label || date || recurrence) await openMoreOptions(page);
  if (label) await dialog.getByLabel(/Description/).fill(label);
  if (category) await chooseCategory(page, category);
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

/**
 * Aucun élément visible hors de l'écran (sauf dans une zone qui défile horizontalement exprès,
 * comme une rangée de puces), et aucun texte coupé net par un conteneur.
 */
export async function expectNothingOffscreen(page: Page) {
  const issues = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsX = (el: Element) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth) return true;
      }
      return false;
    };
    const found: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || style.position === "fixed") continue;
      if (el.closest("[aria-hidden=true], dialog:not([open]), .sr-only")) continue;
      if ((r.right > vw + 1 || r.left < -1) && !scrollsX(el)) found.push(`${el.tagName.toLowerCase()} « ${(el.textContent ?? "").trim().slice(0, 30)} »`);
    }
    return [...new Set(found)].slice(0, 5);
  });
  expect(issues).toEqual([]);
}
