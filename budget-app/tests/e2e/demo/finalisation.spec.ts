/**
 * Finalisation du cœur (mode démo, figé au 13 septembre 2026) : Paramètres sans fonctionnalités fictives,
 * « Mes comptes », note d'une opération, récurrences, catégories, mois futurs et statistiques par mois.
 */
import { expect, test } from "@playwright/test";
import { clean, expectNoA11yViolations, fillOperation, navigate, openAdd, openMoreOptions, sheet } from "../support";

test.describe("Paramètres", () => {
  test("plus aucune fonctionnalité promise mais indisponible", async ({ page }) => {
    await page.goto("/parametres");
    const main = clean(await page.locator("main").innerText());
    for (const text of ["prochaine version", "Bientôt", "Langue", "Devise", "Thème sombre", "Apparence", "Connexion bancaire", "Code de verrouillage", "Face ID", "Notifications"]) {
      expect(main).not.toContain(text);
    }
    for (const text of ["Mes comptes", "Sur tes comptes", "Tout ton argent", "Exporter mes données", "Mode discret"]) {
      expect(main).toContain(text);
    }
  });
});

test.describe("Mes comptes", () => {
  test("modifier le solde de départ, désactiver un compte, comptes proposés dans les opérations", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: "Modifier le compte Compte joint" }).click();
    await expectNoA11yViolations(page);
    await sheet(page).getByLabel("Solde de départ en euros").fill("250");
    await sheet(page).getByLabel("Nom").fill("Compte commun");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Compte commun » mis à jour")).toBeVisible();
    // Solde calculé = solde de départ + opérations du compte (−100 € en démo).
    await expect(page.getByRole("button", { name: "Modifier le compte Compte commun" })).toContainText("150,00");
    await page.getByRole("button", { name: "Modifier le compte Compte commun" }).click();
    await expect(sheet(page).getByLabel("Solde de départ en euros")).toHaveValue("250");
    await sheet(page).getByRole("button", { name: "Fermer" }).click();

    await page.getByRole("button", { name: "Modifier le compte Espèces" }).click();
    await sheet(page).getByRole("switch", { name: "Compte actif" }).click();
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Espèces » désactivé")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier le compte Espèces" })).toContainText("désactivé");

    await navigate(page, "/");
    await openAdd(page);
    await openMoreOptions(page);
    // V3 : un compte d'épargne ne se mouvemente que par transfert ; un compte désactivé n'est plus proposé.
    await expect(sheet(page).getByRole("button", { name: /Compte courant/ })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /Livret A/ })).toHaveCount(0);
    await expect(sheet(page).getByRole("button", { name: /Espèces/ })).toHaveCount(0);
    await sheet(page).getByRole("radio", { name: "Épargne" }).click();
    await expect(sheet(page).getByText("Depuis le compte")).toBeVisible();
    await expect(sheet(page).getByText("Vers le compte d'épargne")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /Livret A/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("ordre d'affichage", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: "Modifier le compte Livret A" }).click();
    await sheet(page).getByRole("button", { name: "Monter le compte" }).click();
    await sheet(page).getByRole("button", { name: "Monter le compte" }).click();
    await sheet(page).getByRole("button", { name: "Monter le compte" }).click();
    await expect(sheet(page).getByText("Position 1 sur 4")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    const names = await page.getByRole("button", { name: /^Modifier le compte / }).evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
    expect(names[0]).toBe("Modifier le compte Livret A");
  });
});

test.describe("Épargne : transfert entre comptes", () => {
  const row = (page: import("@playwright/test").Page, name: string) => page.getByRole("button", { name: `Modifier le compte ${name}` });

  test("verser 100 € du compte courant vers le Livret A : soldes déplacés, patrimoine inchangé, disponible déduit une fois", async ({ page }) => {
    await page.goto("/parametres");
    const patrimoine = page.getByRole("listitem").filter({ hasText: "Tout ton argent" });
    const before = clean(await patrimoine.innerText());
    await expect(row(page, "Livret A")).toContainText("650,00");
    await expect(row(page, "Compte courant")).toContainText("2 090,29");

    await navigate(page, "/");
    await openAdd(page);
    await sheet(page).getByRole("radio", { name: "Épargne" }).click();
    await sheet(page).getByLabel("Montant en euros").fill("100");
    await openMoreOptions(page);
    await sheet(page).getByLabel(/Note/).fill("Transfert de test");
    await sheet(page).getByRole("button", { name: /^Ajouter −100/ }).click();
    await expect(page.getByText(/Épargne ajoutée/)).toBeVisible();

    await navigate(page, "/parametres");
    await expect(row(page, "Livret A")).toContainText("750,00");
    await expect(row(page, "Compte courant")).toContainText("1 990,29");
    expect(clean(await patrimoine.innerText())).toBe(before);

    await navigate(page, "/transactions");
    await page.getByRole("button", { name: /Virement épargne|Épargne/ }).first().click();
    await expect(sheet(page).getByText("Depuis")).toBeVisible();
    await expect(sheet(page).getByText("Vers")).toBeVisible();
  });

  test("désactiver un compte met en pause ses récurrences ; elles ne peuvent pas repartir tant qu'il est désactivé", async ({ page }) => {
    await page.goto("/parametres");
    await row(page, "Compte courant").click();
    await sheet(page).getByRole("switch", { name: "Compte actif" }).click();
    await expect(sheet(page).getByText(/9 récurrences actives sur ce compte seront mises en pause/)).toBeVisible();
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Compte courant » désactivé · 9 récurrences en pause")).toBeVisible();

    await navigate(page, "/budget");
    await expect(page.getByRole("button", { name: /Netflix/ })).toContainText("En pause");
    await page.getByRole("button", { name: /Netflix/ }).click();
    await sheet(page).getByRole("switch", { name: "Récurrence active" }).click();
    await expect(sheet(page).getByText(/Un de ses comptes est désactivé/)).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });
});

test.describe("Mot de passe oublié", () => {
  test("en démo, la page explique pourquoi elle est indisponible", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");
    await expect(page.getByRole("heading", { name: "Mode démo" })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe("Opérations et récurrences", () => {
  test("ajouter, modifier puis effacer la note d'une opération", async ({ page }) => {
    await page.goto("/transactions");
    await openAdd(page);
    await fillOperation(page, { amount: "8", label: "Fleuriste", category: /Shopping/ });
    await sheet(page).getByLabel(/Note/).fill("Pour l'anniversaire de Léa");
    await sheet(page).getByRole("button", { name: /^Ajouter −8/ }).click();
    await page.getByRole("button", { name: /Fleuriste/ }).first().click();
    await expect(sheet(page).getByText("Pour l'anniversaire de Léa")).toBeVisible();

    await sheet(page).getByRole("button", { name: "Modifier" }).click();
    await sheet(page).getByLabel(/Note/).fill("");
    await sheet(page).getByRole("button", { name: /^Enregistrer −8/ }).click();
    await page.getByRole("button", { name: /Fleuriste/ }).first().click();
    await expect(sheet(page).getByText("Pour l'anniversaire de Léa")).toHaveCount(0);
  });

  test("modifier complètement une récurrence", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: /Netflix/ }).click();
    await expectNoA11yViolations(page);
    await sheet(page).getByRole("radio", { name: "Chaque semaine" }).click();
    await sheet(page).getByLabel("Prochaine échéance").fill("2026-09-22");
    await sheet(page).getByLabel("Catégorie").selectOption({ label: "🎟️ Loisirs" });
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Récurrence mise à jour")).toBeVisible();
    await expect(page.getByRole("button", { name: /Netflix/ })).toContainText("Chaque semaine · prochaine le 22 sept.");
  });

  test("une opération prévue le mois prochain est consultable dans Dépenses et revenus", async ({ page }) => {
    await page.goto("/transactions");
    await openAdd(page);
    await fillOperation(page, { amount: "120", label: "Billet de train", category: /Transport/, date: "2026-10-18" });
    await sheet(page).getByRole("button", { name: /^Ajouter −120/ }).click();
    await page.getByLabel("Mois", { exact: true }).selectOption("2026-10");
    await expect(page.getByRole("button", { name: /Billet de train.*Prévu le 18 oct/ })).toBeVisible();
  });
});

test.describe("Catégories", () => {
  test("archiver puis restaurer, créer une catégorie de revenu", async ({ page }) => {
    await page.goto("/parametres");
    await page.getByRole("button", { name: "Modifier la catégorie Shopping" }).click();
    await sheet(page).getByRole("button", { name: "Archiver la catégorie" }).click();
    await sheet(page).getByRole("button", { name: "Archiver", exact: true }).click();
    await expect(page.getByRole("list", { name: "Catégories archivées" })).toContainText("Shopping");
    await page.getByRole("button", { name: "Restaurer la catégorie Shopping" }).click();
    await expect(page.getByText("« Shopping » restaurée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier la catégorie Shopping" })).toBeVisible();

    await page.getByRole("button", { name: /Ajouter une catégorie/ }).click();
    await sheet(page).getByLabel("Nom").fill("Allocations");
    await sheet(page).getByRole("radio", { name: "Revenu" }).click();
    await expect(sheet(page).getByLabel("Budget mensuel en euros")).toHaveCount(0);
    await sheet(page).getByRole("button", { name: "Créer la catégorie" }).click();
    await expect(page.getByRole("list", { name: "Catégories : revenus" })).toContainText("Allocations");
  });
});

test.describe("Statistiques", () => {
  test("choisir le mois de la vue « Mois »", async ({ page }) => {
    await page.goto("/statistiques");
    await expect(page.locator("main header")).toContainText("Septembre 2026");
    await page.getByRole("button", { name: "Mois précédent" }).click();
    await expect(page.locator("main header")).toContainText("Août 2026");
    await expect(page.locator("main")).toContainText("dépensés en août");
    await page.getByRole("radio", { name: "Solde" }).click();
    await expect(page.locator("main")).toContainText("Sur tes comptes");
  });
});
