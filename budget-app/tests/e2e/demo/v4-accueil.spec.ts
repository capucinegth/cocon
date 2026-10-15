/**
 * V4 (mode démo, figé au 13 septembre 2026) : accueil centré sur « Tu peux encore dépenser »,
 * garde de trésorerie (option A : le chiffre du budget n'est jamais remplacé) et ajout rapide.
 */
import { expect, test } from "@playwright/test";
import { clean, expectNoA11yViolations, heroAmount, navigate, openAdd, openMoreOptions, sheet } from "../support";

test.describe("Accueil", () => {
  test("une seule réponse en tête, puis prochainement, mon argent et dernières dépenses", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
    const main = clean(await page.locator("main").innerText());
    expect(main).toContain("Ton budget est confortable pour finir le mois.");
    // Plus de doublons ni de calendrier sur l'accueil, et toujours le mois en cours.
    expect(main.match(/643,20/g)).toHaveLength(1);
    expect(main).not.toContain("Calendrier du mois");
    await expect(page.getByRole("heading", { name: "Attention à l'argent sur tes comptes" })).toHaveCount(0);

    const upcoming = page.locator("section").filter({ has: page.getByRole("heading", { name: "Prochainement" }) });
    // Les 4 opérations à venir de septembre tiennent dans la liste : pas de lien « autres ».
    await expect(upcoming.getByRole("listitem")).toHaveCount(4);
    await expect(upcoming).toContainText("Loyer");
    await expect(upcoming.getByRole("link", { name: /autres? opérations? à venir/ })).toHaveCount(0);

    const money = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mon argent" }) });
    const moneyText = clean(await money.innerText());
    expect(moneyText).toContain("Sur tes comptes 1 949,49 €");
    expect(moneyText).toContain("Épargne 650,00 €");
    expect(moneyText).toContain("2 599,49 €");

    const recent = page.locator("section").filter({ has: page.getByRole("heading", { name: "Dernières dépenses" }) });
    await expect(recent.getByRole("listitem")).toHaveCount(3);
    await expect(recent).not.toContainText("Salaire");
    await expectNoA11yViolations(page);
  });

  test("garde de trésorerie « fin de mois » : alerte, sans toucher au chiffre du budget", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: "Modifier le compte Compte courant" }).click();
    await sheet(page).getByLabel("Solde de départ en euros").fill("500");
    await sheet(page).getByRole("radio", { name: "Négatif (découvert)" }).click();
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Compte courant » mis à jour")).toBeVisible();

    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
    const alert = page.locator("section").filter({ has: page.getByRole("heading", { name: "Attention à l'argent sur tes comptes" }) });
    // 1 059,19 € sur les comptes − 819,99 € à venir = 239,20 € en fin de mois, moins que 643,20 €.
    expect(clean(await alert.innerText())).toContain("il ne resterait que 239,20 € sur tes comptes en fin de mois, moins que les 643,20 €");
    // Pas de phrase rassurante quand l'alerte est là.
    await expect(page.getByText("Ton budget est confortable pour finir le mois.")).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("garde de trésorerie « découvert » : date du point le plus bas", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await sheet(page).getByLabel("Montant en euros").fill("1500");
    await openMoreOptions(page);
    await sheet(page).getByLabel(/Description/).fill("Réparation voiture");
    await sheet(page).getByRole("button", { name: "Autre date" }).click();
    await sheet(page).getByLabel("Choisir une date").fill("2026-09-16");
    await sheet(page).getByRole("button", { name: /^Ajouter −1 500/ }).click();
    // Le chiffre du budget reste celui du budget (643,20 − 1 500).
    await expect.poll(() => heroAmount(page)).toBe("−856,80 €");
    const alert = page.locator("section").filter({ has: page.getByRole("heading", { name: "Attention à l'argent sur tes comptes" }) });
    await expect(alert).toContainText("ton solde pourrait descendre à");
    await expect(alert).toContainText("septembre");
    // 5 opérations à venir : 4 affichées, la dernière derrière un lien.
    const upcoming = page.locator("section").filter({ has: page.getByRole("heading", { name: "Prochainement" }) });
    await expect(upcoming.getByRole("listitem")).toHaveCount(4);
    await expect(upcoming.getByRole("link", { name: "1 autre opération à venir" })).toBeVisible();
  });
});

test.describe("Ajout rapide", () => {
  test("montant → catégorie suggérée → Ajouter, sans ouvrir les options", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await sheet(page).getByLabel("Montant en euros").fill("9,90");
    await expect(sheet(page).getByText("Suggérée d'après tes habitudes")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Plus d'options" })).toHaveAttribute("aria-expanded", "false");
    await expect(sheet(page).getByRole("button", { name: "Plus d'options" })).toHaveAccessibleDescription(/Aujourd'hui · Compte courant/);
    await expect(sheet(page).getByLabel(/Description/)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await sheet(page).getByRole("button", { name: /^Ajouter −9,90/ }).click();
    await expect.poll(() => heroAmount(page)).toBe("633,30 €");
  });

  test("un marchand déjà vu reprend sa catégorie et son compte", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await sheet(page).getByLabel("Montant en euros").fill("31");
    await openMoreOptions(page);
    await sheet(page).getByLabel(/Description/).fill("trattoria mia");
    await expect(sheet(page).getByRole("button", { name: /Restos|Restaurants/ })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page).getByText("Reconnue d'après « trattoria mia »")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /Compte joint/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("un choix explicite n'est jamais écrasé par la reconnaissance du marchand", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await sheet(page).getByLabel("Montant en euros").fill("12");
    await sheet(page).getByRole("button", { name: /^Toutes les catégories/ }).click();
    await sheet(page).getByRole("button", { name: /Loisirs/ }).click();
    await openMoreOptions(page);
    await sheet(page).getByLabel(/Description/).fill("Carrefour");
    await expect(sheet(page).getByRole("button", { name: /Loisirs/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("toutes les catégories restent accessibles", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    const toggle = sheet(page).getByRole("button", { name: /^Toutes les catégories/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    for (const name of ["Logement", "Courses", "Transport", "Restos", "Loisirs", "Shopping", "Santé", "Abos", "Autres"]) {
      await expect(sheet(page).getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(sheet(page).getByRole("button", { name: "Moins de catégories" })).toBeVisible();
  });
});

test("l'écran « Dépenses et revenus » garde le calendrier du mois", async ({ page }, testInfo) => {
  await page.goto("/");
  await navigate(page, "/transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Dépenses et revenus" })).toBeVisible();
  if (testInfo.project.name === "mobile") await page.getByText("Voir le mois en calendrier").click();
  await expect(page.getByRole("heading", { name: "Calendrier du mois" })).toBeVisible();
  const main = clean(await page.locator("main").innerText());
  expect(main).toContain("Reçu");
  expect(main).toContain("Dépensé");
});
