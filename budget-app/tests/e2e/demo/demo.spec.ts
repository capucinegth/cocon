/**
 * Mode démo : les chiffres et parcours de la V2 sont conservés,
 * et les nouveautés V3 (modification, récurrences, budget par mois) fonctionnent.
 * Démo figée au dimanche 13 septembre 2026.
 */
import { expect, test } from "@playwright/test";
import { clean, fillOperation, heroAmount, navigate, openAdd, sheet } from "../support";

test.describe("Accueil", () => {
  test("chiffres de septembre ; le calcul et le bilan d'août sont dans Budget", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
    const main = clean(await page.locator("main").innerText());
    for (const text of ["Tu peux encore dépenser", "≈ 35,73 € / jour", "18 prochains jours", "Confortable", "Loyer", "Électricité"]) {
      expect(main).toContain(text);
    }
    // L'accueil montre toujours le mois en cours : plus de sélecteur de mois.
    await expect(page.getByRole("button", { name: "Mois précédent" })).toHaveCount(0);
    await page.getByRole("link", { name: /Voir le calcul/ }).click();
    await page.waitForURL((url) => url.pathname === "/budget");
    await expect(page.locator("#calcul")).toContainText("Tu peux encore dépenser");
    expect(clean(await page.locator("#calcul").innerText())).toContain("Tu peux encore dépenser 643,20 €");
    await page.getByRole("button", { name: "Mois précédent" }).click();
    expect(clean(await page.locator("#calcul").innerText())).toContain("Resté en fin de mois 96,00 €");
  });

  test("le mode démo est clairement signalé et la connexion explique pourquoi elle est indisponible", async ({ page }) => {
    await page.goto("/parametres");
    await expect(page.getByText("Mode démo · données fictives, rien n'est enregistré")).toBeVisible();
    await expect(page.getByRole("button", { name: /Se déconnecter/ })).toHaveCount(0);
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { name: "Mode démo" })).toBeVisible();
    await page.getByRole("link", { name: "Ouvrir la démo" }).click();
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
  });
});

test.describe("Opérations", () => {
  test("ajout ponctuel puis annulation", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await fillOperation(page, { amount: "12,5", label: "Boulangerie", category: /Courses/ });
    await sheet(page).getByRole("button", { name: /^Ajouter −12,50/ }).click();
    await expect.poll(() => heroAmount(page)).toBe("630,70 €");
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
  });

  test("ajout « chaque semaine » : les prochaines échéances du mois sont déjà déduites", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await fillOperation(page, { amount: "12,5", label: "Boulangerie", category: /Courses/, recurrence: "Chaque semaine" });
    await sheet(page).getByRole("button", { name: /^Ajouter −12,50/ }).click();
    // 13, 20 et 27 septembre : 3 × 12,50 €.
    await expect.poll(() => heroAmount(page)).toBe("605,70 €");
    await navigate(page, "/budget");
    await expect(page.getByRole("button", { name: /Boulangerie/ })).toBeVisible();
  });

  test("une opération datée dans le futur apparaît dans « À venir »", async ({ page }) => {
    await page.goto("/");
    await openAdd(page);
    await fillOperation(page, { amount: "40", label: "Cadeau Léa", category: /Shopping/, date: "2026-09-25" });
    await expect(sheet(page).getByText(/Date à venir/)).toBeVisible();
    await sheet(page).getByRole("button", { name: /^Ajouter −40/ }).click();
    await expect.poll(() => heroAmount(page)).toBe("603,20 €");
    await navigate(page, "/transactions");
    await expect(page.getByRole("button", { name: /Cadeau Léa.*Prévu le 25 sept/ })).toBeVisible();
  });

  test("modifier une opération met tout à jour", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /Carrefour/ }).first().click();
    await sheet(page).getByRole("button", { name: "Modifier" }).click();
    await expect(sheet(page).getByRole("heading", { name: "Modifier l'opération" })).toBeVisible();
    await sheet(page).getByLabel("Montant en euros").fill("60");
    await sheet(page).getByRole("button", { name: /^Enregistrer −60/ }).click();
    await expect(page.getByText("Opération modifiée")).toBeVisible();
    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("637,40 €");
  });

  test("supprimer puis restaurer", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /Carrefour/ }).first().click();
    await sheet(page).getByRole("button", { name: "Supprimer" }).click();
    await expect(page.getByText("Opération supprimée")).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
  });

  test("filtres : type, mois, catégorie et recherche", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("radio", { name: "Revenus" }).click();
    await expect(page.getByText("1 opération", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "Tout" }).click();
    await page.getByLabel("Mois", { exact: true }).selectOption("2026-08");
    await expect(page.getByText("33 opérations", { exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Rechercher une dépense ou un revenu" }).fill("carrefour");
    await expect(page.getByText("3 opérations", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Effacer les filtres" }).click();
    await expect(page.getByText("33 opérations", { exact: true })).toBeVisible();
  });
});

test.describe("Budget", () => {
  test("modifier le budget d'une catégorie", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: "Courses : modifier le budget" }).click();
    await sheet(page).getByLabel("Budget du mois en euros").fill("350");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Courses » mise à jour")).toBeVisible();
    await expect(page.locator("main")).toContainText("230 € / 350 €");
  });

  test("le mois suivant reprend le budget et peut être préparé", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: "Mois suivant" }).click();
    await expect(page.getByRole("heading", { name: "Budget d'octobre" })).toBeVisible();
    await expect(page.getByText(/Budget repris de septembre 2026/)).toBeVisible();
  });

  test("revenus et épargne prévus", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: "Modifier les revenus et l'épargne prévus" }).click();
    await sheet(page).getByLabel("Épargne prévue en euros").fill("400");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("543,20 €");
  });
});

test.describe("Objectifs", () => {
  test("verser, créer, modifier, supprimer", async ({ page }) => {
    await page.goto("/objectifs");
    await page.getByRole("button", { name: "Verser" }).first().click();
    await expect(sheet(page).getByRole("button", { name: /Vacances/ })).toHaveAttribute("aria-pressed", "true");
    await sheet(page).getByLabel("Montant en euros").fill("50");
    await sheet(page).getByRole("button", { name: /^Ajouter −50/ }).click();
    await expect(page.locator("main")).toContainText("1 300 € / 2 000 €");

    await page.getByRole("button", { name: "Nouvel objectif" }).last().click();
    await sheet(page).getByLabel("Nom de l'objectif").fill("Vélo");
    await sheet(page).getByLabel("Montant à atteindre en euros").fill("600");
    await sheet(page).getByRole("button", { name: "Créer l'objectif" }).click();
    await expect(page.getByRole("heading", { name: "Vélo" })).toBeVisible();

    await page.getByRole("button", { name: "Modifier l'objectif Vélo" }).click();
    await sheet(page).getByLabel("Montant à atteindre en euros").fill("800");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("main")).toContainText("0 € / 800 €");

    await page.getByRole("button", { name: "Modifier l'objectif Vélo" }).click();
    await sheet(page).getByRole("button", { name: "Supprimer l'objectif" }).click();
    await sheet(page).getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vélo" })).toHaveCount(0);
  });
});

test.describe("Paramètres", () => {
  test("mode discret conservé après rechargement, réinitialisation de la démo", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("switch", { name: "Mode discret" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-discreet", "");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-discreet", "");
    await expect(page.getByRole("switch", { name: "Mode discret" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: "Mode discret" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-discreet", "");

    await page.getByRole("button", { name: /Réinitialiser la démo/ }).click();
    await expect(page.getByText("Données de démo restaurées")).toBeVisible();
  });
});
