/** Accessibilité (axe-core, WCAG 2.1 AA) et mise en page sans débordement, de 390 à 1440 px. */
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow, openAdd } from "../support";

const pages = ["/", "/budget", "/transactions", "/objectifs", "/statistiques", "/parametres", "/connexion", "/mot-de-passe-oublie"];

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

test("aucun débordement horizontal en 390, 430, 768, 1024 et 1440 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Les largeurs sont parcourues une seule fois.");
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  }
});
