/**
 * « Mes papiers » avec de vraies données (pile Supabase LOCALE) : A importe, voit, consulte et télécharge
 * par lien temporaire, puis supprime ; B, sur un autre compte, ne voit jamais le document de A.
 */
import { expect, test, type Page } from "@playwright/test";
import { sheet } from "../support";
import { signUp } from "./helpers";

const pdf = { name: "avis_impot_2026.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% avis de test\n%%EOF\n") };

/** Lien obtenu par « Consulter » : affiché (lecteur PDF) ou téléchargé (navigateur de test sans lecteur). */
function nextViewerUrl(page: Page): Promise<string> {
  return new Promise((resolve) =>
    page.context().once("page", (viewer) => {
      viewer.once("download", (download) => resolve(download.url()));
      viewer.waitForURL(/\/storage\/v1\//).then(() => resolve(viewer.url()), () => {});
    }),
  );
}

test("A importe, voit, consulte, télécharge et supprime ; B ne voit jamais le document de A", async ({ page, browser }) => {
  await signUp(page, { prefix: "papiers-a" });
  await page.goto("/administratif");
  await expect(page.getByText("Range ici tes papiers")).toBeVisible();

  await page.getByRole("button", { name: "Ajouter un document" }).filter({ visible: true }).first().click();
  const chooser = page.waitForEvent("filechooser");
  await sheet(page).getByRole("button", { name: "Choisir un fichier" }).click();
  await (await chooser).setFiles(pdf);
  await expect(sheet(page).getByLabel("Titre")).toHaveValue("Avis d'imposition · 2026");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("« Avis d'imposition · 2026 » ajouté dans Impôts")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Avis d'imposition · 2026/ }).first().click();
  const viewed = nextViewerUrl(page);
  await sheet(page).getByRole("button", { name: "Consulter" }).click();
  const url = await viewed;
  // Lien temporaire signé de l'espace privé, jamais une URL publique.
  expect(url).toContain("/storage/v1/object/sign/documents/");
  expect(url).toContain("token=");
  expect(url).not.toContain("/object/public/");

  const download = page.waitForEvent("download");
  await sheet(page).getByRole("button", { name: "Télécharger" }).click();
  expect((await download).suggestedFilename()).toBe("avis_impot_2026.pdf");
  await page.keyboard.press("Escape");

  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const bob = await context.newPage();
  await signUp(bob, { prefix: "papiers-b" });
  await bob.goto("/administratif");
  await expect(bob.getByText("Range ici tes papiers")).toBeVisible();
  await expect(bob.getByText("Avis d'imposition")).toHaveCount(0);
  await bob.goto("/administratif/impots");
  await expect(bob.getByText("0 document")).toBeVisible();
  await context.close();

  await page.getByRole("button", { name: /Avis d'imposition · 2026/ }).first().click();
  await sheet(page).getByRole("button", { name: "Supprimer le document" }).click();
  await sheet(page).getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByText("Document supprimé")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Range ici tes papiers")).toBeVisible();
  // L'ancien lien temporaire ne donne plus accès au fichier.
  expect((await page.request.get(url)).status()).toBeGreaterThanOrEqual(400);
});
