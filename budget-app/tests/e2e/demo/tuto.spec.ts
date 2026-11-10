/** Tuto de découverte (mode démo) : pas d'ouverture automatique, accessible depuis Paramètres → Aide. */
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, heroAmount, navigate, sheet } from "../support";

test("démo : le tuto ne s'ouvre pas tout seul ; Paramètres → Aide le rouvre, étape par étape", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => heroAmount(page)).toBe("1 129,50 €");
  await expect(page.getByRole("heading", { name: "Découvrir Cocon" })).toHaveCount(0);

  await navigate(page, "/parametres");
  await page.getByRole("button", { name: /Revoir le tuto/ }).click();
  await expect(sheet(page).getByRole("heading", { name: "Découvrir Cocon" })).toBeVisible();
  await expect(sheet(page)).toContainText("Étape 1 sur 7");
  await expect(sheet(page).getByRole("heading", { name: "Bienvenue dans Cocon" })).toBeVisible();
  await expectNoA11yViolations(page);

  await sheet(page).getByRole("button", { name: /Suivant/ }).click();
  await expect(sheet(page)).toContainText("Étape 2 sur 7");
  await expect(sheet(page)).toContainText("Paramètres → Mes comptes");
  await sheet(page).getByRole("button", { name: /Précédent/ }).click();
  await expect(sheet(page)).toContainText("Étape 1 sur 7");

  for (let step = 2; step <= 7; step += 1) {
    await sheet(page).getByRole("button", { name: /Suivant/ }).click();
    await expect(sheet(page)).toContainText(`Étape ${step} sur 7`);
  }
  await expect(sheet(page).getByRole("button", { name: /Suivant/ })).toHaveCount(0);
  await sheet(page).getByRole("button", { name: "C'est parti" }).click();
  await expect(sheet(page)).toHaveCount(0);

  // Rouvert : il repart de la première étape.
  await page.getByRole("button", { name: /Revoir le tuto/ }).click();
  await expect(sheet(page)).toContainText("Étape 1 sur 7");
  await sheet(page).getByRole("button", { name: "Passer" }).click();
  await expect(sheet(page)).toHaveCount(0);
});
