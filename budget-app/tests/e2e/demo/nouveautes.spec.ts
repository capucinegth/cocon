/**
 * Créer un compte et ajouter une charge fixe (mode démo, figé au 13 septembre 2026).
 * Une charge dont le prélèvement de ce mois est déjà passé n'est pas déduite du disponible.
 */
import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, heroAmount, navigate, openAdd, sheet } from "../support";

test.describe("Créer un compte", () => {
  test("un compte courant : listé avec son solde, proposé pour les opérations", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: /Ajouter un compte/ }).click();
    await expect(sheet(page).getByRole("heading", { name: "Nouveau compte" })).toBeVisible();
    await expectNoA11yViolations(page);
    await sheet(page).getByLabel("Nom").fill("Boursorama");
    await sheet(page).getByRole("button", { name: /Compte courant/ }).click();
    await sheet(page).getByLabel("Solde de départ en euros").fill("300");
    await sheet(page).getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByText("Compte « Boursorama » créé")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier le compte Boursorama" })).toContainText("300,00");

    await navigate(page, "/");
    await openAdd(page);
    await expect(sheet(page).getByRole("button", { name: /Boursorama/ })).toBeVisible();
  });

  test("un compte d'épargne : proposé seulement comme destination d'une épargne", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: /Ajouter un compte/ }).click();
    await sheet(page).getByLabel("Nom").fill("LDDS");
    await sheet(page).getByRole("button", { name: /Épargne/ }).click();
    await sheet(page).getByLabel("Solde de départ en euros").fill("1200");
    await sheet(page).getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByRole("button", { name: "Modifier le compte LDDS" })).toContainText("1 200,00");

    await navigate(page, "/");
    await openAdd(page);
    await expect(sheet(page).getByRole("button", { name: /LDDS/ })).toHaveCount(0);
    await sheet(page).getByRole("radio", { name: "Épargne" }).click();
    await expect(sheet(page).getByRole("button", { name: /LDDS/ })).toBeVisible();
  });

  test("deux comptes ne peuvent pas porter le même nom", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: /Ajouter un compte/ }).click();
    await sheet(page).getByLabel("Nom").fill("livret a");
    await expect(sheet(page).getByRole("button", { name: "Un compte porte déjà ce nom" })).toBeDisabled();
  });
});

test.describe("Charges fixes", () => {
  test("prélèvement de ce mois déjà passé : pas déduit du disponible, premier prélèvement le mois prochain", async ({ page }) => {
    await page.goto("/");
    const before = await heroAmount(page);
    await navigate(page, "/budget");
    await page.getByRole("button", { name: "Charge fixe" }).click();
    await expect(sheet(page).getByRole("heading", { name: "Nouvelle charge fixe" })).toBeVisible();
    await expectNoA11yViolations(page);
    await sheet(page).getByLabel("Nom").fill("Assurance habitation");
    await sheet(page).getByLabel("Montant en euros").fill("18,50");
    await sheet(page).getByLabel("Jour du prélèvement").fill("5");
    await expect(sheet(page).getByText(/déjà passé : il n'est pas déduit de ton solde actuel/)).toBeVisible();
    await expect(sheet(page).getByText(/lundi 5 octobre/)).toBeVisible();
    await sheet(page).getByRole("button", { name: /^Ajouter la charge/ }).click();
    await expect(page.getByText(/« Assurance habitation » ajoutée/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Assurance habitation/ })).toContainText("Chaque mois · prochaine le 5 oct.");

    await navigate(page, "/");
    expect(await heroAmount(page)).toBe(before);
  });

  test("prélèvement encore à venir ce mois-ci : prévu, il réduit ce qui reste à dépenser", async ({ page }) => {
    await page.goto("/");
    expect(await heroAmount(page)).toBe("643,20 €");
    await navigate(page, "/budget");
    await page.getByRole("button", { name: "Charge fixe" }).click();
    await sheet(page).getByLabel("Nom").fill("Mutuelle");
    await sheet(page).getByLabel("Montant en euros").fill("30");
    await sheet(page).getByLabel("Jour du prélèvement").fill("25");
    await expect(sheet(page).getByText(/Premier prélèvement : le vendredi 25 septembre/)).toBeVisible();
    await sheet(page).getByRole("button", { name: /^Ajouter la charge · −30/ }).click();
    await expect(page.getByRole("button", { name: /Mutuelle/ })).toContainText("prochaine le 25 sept.");

    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("613,20 €");
  });
});
