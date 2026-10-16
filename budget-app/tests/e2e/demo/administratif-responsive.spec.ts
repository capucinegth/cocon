/**
 * « Mes papiers » de 320 à 1440 px : recherche, filtres, feuille d'import (photos de plusieurs pages
 * et formulaire), fiche d'un document (information et échéance en cours de saisie), confirmation de suppression.
 * Aucun débordement, aucun élément hors de l'écran, accessibilité vérifiée sur les feuilles.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalOverflow, expectNothingOffscreen, sheet } from "../support";

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];

async function photo(page: Page, label: string) {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 900, height: 1200 });
  await other.setContent(`<body style="margin:0;background:#fff;font:32px sans-serif;padding:60px">${label}</body>`);
  const buffer = await other.screenshot({ type: "jpeg", quality: 70 });
  await other.close();
  return { name: `${label}.jpg`, mimeType: "image/jpeg", buffer };
}

async function fits(page: Page) {
  await expectNoHorizontalOverflow(page);
  await expectNothingOffscreen(page);
  // Une feuille ouverte ne dépasse jamais l'écran.
  const open = page.locator("dialog[open]");
  const dialog = (await open.count()) > 0 ? await open.boundingBox() : null;
  if (dialog) {
    const viewport = page.viewportSize()!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(dialog.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

test("pages, recherche et filtres de « Mes papiers » tiennent à l'écran", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Les largeurs sont parcourues une seule fois.");
  test.setTimeout(240_000);
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await page.goto("/administratif");
    await page.getByRole("searchbox", { name: "Rechercher un document" }).fill("assurance");
    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
    await fits(page);
    await page.goto("/administratif/assurances");
    await page.getByLabel("Type de document").selectOption({ label: "Assurance habitation" });
    await page.getByRole("button", { name: "À vérifier", exact: true }).click();
    await fits(page);
  }
});

test("feuilles d'import et de document tiennent à l'écran, de 320 à 1440 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Les largeurs sont parcourues une seule fois.");
  test.setTimeout(300_000);
  const pages = [await photo(page, "Page 1"), await photo(page, "Page 2")];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 });
    await page.goto("/administratif");
    await page.getByRole("button", { name: "Ajouter un document" }).filter({ visible: true }).first().click();
    await fits(page);
    const chooser = page.waitForEvent("filechooser");
    await sheet(page).getByRole("button", { name: "Choisir une photo" }).click();
    await (await chooser).setFiles(pages);
    await expect(sheet(page).getByText("Page 2/2")).toBeVisible();
    await sheet(page).getByRole("button", { name: /Impôts/ }).click();
    await fits(page);
    if (width === 390 || width === 1440) await expectNoA11yViolations(page);
    await sheet(page).getByRole("button", { name: "Fermer" }).click();

    await page.getByRole("button", { name: /Fiche de paie · août 2026/ }).first().click();
    await sheet(page).getByRole("button", { name: "Modifier : Salaire brut" }).click();
    await sheet(page).getByRole("button", { name: "Ajouter une échéance" }).click();
    await fits(page);
    await sheet(page).getByRole("button", { name: "Supprimer le document" }).click();
    await expect(sheet(page).getByRole("button", { name: "Supprimer", exact: true })).toBeVisible();
    await fits(page);
    if (width === 390 || width === 1440) await expectNoA11yViolations(page);
    await sheet(page).getByRole("button", { name: "Fermer" }).click();
  }
});
