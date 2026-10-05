/** Deux comptes sur le même service : aucune donnée ne passe de l'un à l'autre. */
import { expect, test } from "@playwright/test";
import { fillOperation, openAdd, sheet } from "../support";
import { signUp } from "./helpers";

test("les opérations, objectifs et budgets d'Alice sont invisibles pour Bob", async ({ page, browser }) => {
  await signUp(page, { name: "Alice", prefix: "alice" });
  await openAdd(page);
  await fillOperation(page, { amount: "321", label: "Secret d'Alice", category: /Shopping/ });
  await sheet(page).getByRole("button", { name: /^Ajouter −321/ }).click();
  await expect(page.getByText(/Dépense ajoutée/)).toBeVisible();
  await page.goto("/objectifs");
  await page.getByRole("button", { name: "Nouvel objectif" }).last().click();
  await sheet(page).getByLabel("Nom de l'objectif").fill("Projet d'Alice");
  await sheet(page).getByLabel("Montant à atteindre en euros").fill("500");
  await sheet(page).getByRole("button", { name: "Créer l'objectif" }).click();
  await expect(page.getByRole("heading", { name: "Projet d'Alice" })).toBeVisible();

  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const bob = await context.newPage();
  await signUp(bob, { name: "Bob", prefix: "bob" });
  await expect(bob.getByRole("heading", { name: "Bienvenue dans Cocon, Bob" })).toBeVisible();
  await bob.goto("/transactions");
  await expect(bob.getByText("Aucune opération ce mois-ci")).toBeVisible();
  await expect(bob.getByText("Secret d'Alice")).toHaveCount(0);
  await bob.goto("/objectifs");
  await expect(bob.getByText("Projet d'Alice")).toHaveCount(0);
  await context.close();
});
