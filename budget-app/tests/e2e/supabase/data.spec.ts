/**
 * Données réelles : tout ce qui est saisi est enregistré, retrouvé après rechargement
 * et sur un autre appareil, et les calculs suivent automatiquement.
 */
import { expect, test } from "@playwright/test";
import { fillOperation, heroAmount, openAdd, sheet } from "../support";
import { otherDevice, signUp } from "./helpers";

test("dépense : ajout, rechargement, autre appareil, modification, suppression", async ({ page, browser }) => {
  const email = await signUp(page);
  await openAdd(page);
  await fillOperation(page, { amount: "54,2", label: "Carrefour", category: /Courses/ });
  await sheet(page).getByRole("button", { name: /^Ajouter −54,20/ }).click();
  await expect(page.getByText("Dépense ajoutée · −54,20 €")).toBeVisible();
  await expect.poll(() => heroAmount(page)).toBe("−54,20 €");

  await page.reload();
  await expect.poll(() => heroAmount(page)).toBe("−54,20 €");
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /^Carrefour/ })).toBeVisible();

  const phone = await otherDevice(browser, email);
  await phone.goto("/transactions");
  await expect(phone.getByRole("button", { name: /^Carrefour/ })).toBeVisible();

  await page.getByRole("button", { name: /^Carrefour/ }).click();
  await sheet(page).getByRole("button", { name: "Modifier" }).click();
  await sheet(page).getByLabel("Montant en euros").fill("60");
  await sheet(page).getByRole("button", { name: /^Enregistrer −60/ }).click();
  await expect(page.getByText("Opération modifiée")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Carrefour Courses −60 €" })).toBeVisible();

  await page.getByRole("button", { name: /^Carrefour/ }).click();
  await sheet(page).getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Opération supprimée")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Rien ce mois-ci")).toBeVisible();
  await phone.reload();
  await expect(phone.getByText("Rien ce mois-ci")).toBeVisible();
  await phone.context().close();
});

test("revenu, budget et épargne prévue : le disponible se calcule tout seul", async ({ page }) => {
  await signUp(page);
  await openAdd(page);
  await fillOperation(page, { kind: "Revenu", amount: "2000", label: "Salaire", category: /Salaire/ });
  await sheet(page).getByRole("button", { name: /^Ajouter \+2 000/ }).click();
  await expect.poll(() => heroAmount(page)).toBe("2 000,00 €");

  await page.goto("/budget");
  await page.getByRole("button", { name: "Courses : modifier le budget" }).click();
  await sheet(page).getByLabel("Budget du mois en euros").fill("300");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator("main")).toContainText("0 € / 300 €");

  await page.getByRole("button", { name: "Modifier les revenus et l'épargne prévus" }).click();
  await sheet(page).getByLabel("Épargne prévue en euros").fill("200");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();

  await openAdd(page);
  await fillOperation(page, { amount: "50", category: /Courses/ });
  await sheet(page).getByRole("button", { name: /^Ajouter −50/ }).click();
  await expect(page.locator("main")).toContainText("50 € / 300 €");

  await page.goto("/");
  await expect.poll(() => heroAmount(page)).toBe("1 750,00 €");
  await page.reload();
  await expect.poll(() => heroAmount(page)).toBe("1 750,00 €");
});

test("récurrence mensuelle : visible dans le budget, mise en pause, suppression", async ({ page }) => {
  await signUp(page);
  await openAdd(page);
  await fillOperation(page, { amount: "650", label: "Loyer", category: /Logement/, recurrence: "Chaque mois" });
  await sheet(page).getByRole("button", { name: /^Ajouter −650/ }).click();
  // Enregistrement terminé avant de recharger une autre page (sinon la requête peut être interrompue).
  await expect(page.getByText(/Dépense ajoutée/)).toBeVisible();
  await page.goto("/budget");
  const rule = page.getByRole("button", { name: /Loyer.*Chaque mois · prochaine le/ });
  await expect(rule).toBeVisible();

  await rule.click();
  await sheet(page).getByRole("switch", { name: "Récurrence active" }).click();
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Récurrence mise en pause")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Loyer.*En pause/ })).toBeVisible();

  await page.getByRole("button", { name: /Loyer.*En pause/ }).click();
  await sheet(page).getByRole("button", { name: "Supprimer la récurrence" }).click();
  await sheet(page).getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Récurrence supprimée")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Aucune pour l'instant/)).toBeVisible();
  // L'opération déjà passée est conservée.
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /^Loyer/ })).toBeVisible();
});

test("objectif : création, versement, progression, suppression", async ({ page, browser }) => {
  const email = await signUp(page);
  await page.goto("/objectifs");
  await expect(page.getByText(/Crée ton premier objectif/)).toBeVisible();
  await page.getByRole("button", { name: "Nouvel objectif" }).last().click();
  await sheet(page).getByLabel("Nom de l'objectif").fill("Vacances");
  await sheet(page).getByLabel("Montant à atteindre en euros").fill("1000");
  await sheet(page).getByLabel("Déjà épargné").fill("100");
  await sheet(page).getByRole("button", { name: "Créer l'objectif" }).click();
  await expect(page.locator("main")).toContainText("100 € / 1 000 €");
  await expect(page.getByRole("img", { name: "Vacances : 10 %" }).or(page.getByLabel("Vacances : 10 %"))).toBeVisible();

  await page.getByRole("button", { name: "Verser" }).click();
  await expect(sheet(page).getByRole("button", { name: /Vacances/ })).toHaveAttribute("aria-pressed", "true");
  await sheet(page).getByLabel("Montant en euros").fill("150");
  await sheet(page).getByRole("button", { name: /^Ajouter −150/ }).click();
  await expect(page.locator("main")).toContainText("250 € / 1 000 €");

  const phone = await otherDevice(browser, email);
  await phone.goto("/objectifs");
  await expect(phone.locator("main")).toContainText("250 € / 1 000 €");
  await phone.context().close();

  await page.getByRole("button", { name: "Modifier l'objectif Vacances" }).click();
  await sheet(page).getByRole("button", { name: "Supprimer l'objectif" }).click();
  await sheet(page).getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Objectif « Vacances » supprimé")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vacances" })).toHaveCount(0);
});

test("catégorie personnalisée : création avec budget, archivage", async ({ page }) => {
  await signUp(page);
  await page.goto("/budget");
  await page.locator("main").getByRole("button", { name: "Ajouter" }).last().click();
  await sheet(page).getByLabel("Nom").fill("Animaux");
  await sheet(page).getByLabel("Budget mensuel en euros").fill("40");
  await sheet(page).getByRole("button", { name: "Créer la catégorie" }).click();
  await expect(page.getByText("Catégorie « Animaux » créée")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Animaux : modifier le budget" })).toBeVisible();
  await expect(page.locator("main")).toContainText("0 € / 40 €");

  await page.getByRole("button", { name: "Animaux : modifier le budget" }).click();
  await sheet(page).getByRole("button", { name: "Archiver la catégorie" }).click();
  await sheet(page).getByRole("button", { name: "Archiver", exact: true }).click();
  await expect(page.getByText("« Animaux » archivée")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Animaux : modifier le budget" })).toHaveCount(0);
});

test("profil et mode discret suivent le compte sur un autre appareil", async ({ page, browser }) => {
  const email = await signUp(page);
  await page.goto("/parametres");
  await page.getByRole("button", { name: /Mon profil/ }).click();
  await sheet(page).getByLabel("Ton prénom (ou pseudo)").fill("Sacha");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
  await page.getByRole("switch", { name: "Mode discret" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-discreet", "");
  // Le changement n'est affiché qu'après enregistrement ; on laisse aussi finir le réseau.
  await page.waitForLoadState("networkidle");

  const phone = await otherDevice(browser, email);
  await expect(phone.getByRole("heading", { name: "Bonjour Sacha 👋" })).toBeVisible();
  await expect(phone.locator("html")).toHaveAttribute("data-discreet", "");
  await phone.goto("/parametres");
  await expect(phone.getByRole("switch", { name: "Mode discret" })).toHaveAttribute("aria-checked", "true");
  await phone.context().close();
});

test("export CSV de ses opérations", async ({ page }) => {
  await signUp(page);
  await openAdd(page);
  await fillOperation(page, { amount: "12,5", label: "Boulangerie", category: /Courses/ });
  await sheet(page).getByRole("button", { name: /^Ajouter −12,50/ }).click();
  await expect(page.getByText(/Dépense ajoutée/)).toBeVisible();
  await page.goto("/parametres");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exporter mes données/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^cocon-operations-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = await (await file.createReadStream()).toArray();
  const text = Buffer.concat(content).toString("utf8");
  expect(text).toContain("Date;Libellé;Type;Catégorie;Objectif;Compte;Montant (€);Note");
  expect(text).toContain("Boulangerie;Dépense;Courses;;Compte courant;-12,50;");
});

test("enregistrement impossible (réseau coupé) : erreur claire, saisie conservée, puis succès", async ({ page }) => {
  await signUp(page);
  await openAdd(page);
  await fillOperation(page, { amount: "8,9", label: "Pharmacie", category: /Santé/ });
  await page.route("**/rest/v1/transactions**", (route) => route.abort("internetdisconnected"));
  await sheet(page).getByRole("button", { name: /^Ajouter −8,90/ }).click();
  await expect(sheet(page).getByRole("alert")).toContainText("Connexion impossible pour enregistrer l'opération");
  await expect(sheet(page).getByLabel("Montant en euros")).toHaveValue("8,9");
  await page.unroute("**/rest/v1/transactions**");
  await sheet(page).getByRole("button", { name: /^Ajouter −8,90/ }).click();
  await expect(page.getByText("Dépense ajoutée · −8,90 €")).toBeVisible();
  await page.reload();
  await expect.poll(() => heroAmount(page)).toBe("−8,90 €");
});

test("chargement puis erreur de chargement, avec « Réessayer »", async ({ page }) => {
  await signUp(page);
  await page.route("**/rest/v1/categories**", (route) => route.abort("internetdisconnected"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tes données n'ont pas pu être chargées" })).toBeVisible();
  await page.unroute("**/rest/v1/categories**");
  await page.route("**/rest/v1/categories**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Chargement de tes données…" })).toBeAttached();
  await expect.poll(() => heroAmount(page)).toBe("0,00 €");
});
