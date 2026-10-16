/** Accessibilité (axe-core, WCAG 2.1 AA) et mise en page sans débordement, de 320 à 1440 px. */
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow, expectNothingOffscreen, openAdd, openMoreOptions, sheet } from "../support";

const pages = ["/", "/budget", "/transactions", "/objectifs", "/administratif", "/administratif/professionnel", "/administratif/echeances", "/statistiques", "/parametres", "/connexion", "/mot-de-passe-oublie"];

test("aucune violation d'accessibilité sur toutes les pages", async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  }
  await page.goto("/");
  await openAdd(page);
  await expectNoA11yViolations(page);
});

/** Largeurs de référence : petits téléphones → grands écrans. */
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];

test("aucun débordement ni élément hors écran, de 320 à 1440 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Les largeurs sont parcourues une seule fois.");
  test.setTimeout(360_000);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNothingOffscreen(page);
    }
  }
});

test("feuilles d'ajout et de compte : tout tient à l'écran, de 320 à 1440 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Les largeurs sont parcourues une seule fois.");
  test.setTimeout(180_000);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await page.goto("/");
    await openAdd(page);
    await sheet(page).getByRole("button", { name: /^Toutes les catégories/ }).click();
    await openMoreOptions(page);
    await expectNoHorizontalOverflow(page);
    await expectNothingOffscreen(page);
    await page.goto("/parametres");
    await page.getByRole("button", { name: /Ajouter un compte/ }).click();
    await expect(sheet(page)).toBeVisible();
    await expectNothingOffscreen(page);
  }
});
