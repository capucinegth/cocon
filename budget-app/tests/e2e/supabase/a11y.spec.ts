/** Accessibilité (axe-core, WCAG 2.1 AA) et absence de débordement horizontal, compte réel. */
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow, fillOperation, openAdd, sheet } from "../support";
import { signUp } from "./helpers";

test("pages de connexion et d'inscription", async ({ page }) => {
  for (const path of ["/connexion", "/connexion?raison=session", "/inscription"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflow(page);
  }
});

test("toutes les pages, compte neuf puis avec des données", async ({ page }) => {
  await signUp(page, { name: "Camille" });
  const pages = ["/", "/budget", "/transactions", "/objectifs", "/statistiques", "/parametres"];
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/");
  await openAdd(page);
  await fillOperation(page, { kind: "Revenu", amount: "1800", category: /Salaire/ });
  await expectNoA11yViolations(page);
  await sheet(page).getByRole("button", { name: /^Ajouter \+1 800/ }).click();
  await openAdd(page);
  await fillOperation(page, { amount: "64", label: "Restaurant", category: /Restaurants/, recurrence: "Chaque mois" });
  await sheet(page).getByRole("button", { name: /^Ajouter −64/ }).click();
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoA11yViolations(page);
    await expectNoHorizontalOverflow(page);
  }
});
