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

/** Feuille posée de travers sur une table sombre. */
async function tablePhoto(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 900, height: 1200 });
  await other.setContent(
    `<body style="margin:0;height:1200px;background:#3b332d;display:grid;place-items:center;overflow:hidden">` +
      `<div style="width:560px;height:780px;background:#fbf8f1;transform:rotate(-6deg);font:30px sans-serif;padding:50px;box-sizing:border-box">Carte grise<hr><p>Texte</p></div></body>`,
  );
  const buffer = await other.screenshot({ type: "jpeg", quality: 85 });
  await other.close();
  return { name: "IMG_0042.jpg", mimeType: "image/jpeg", buffer };
}

test("photo scannée rangée dans un nouveau dossier ; supprimer le dossier garde le document", async ({ page }) => {
  await signUp(page, { prefix: "papiers-dossier" });
  await page.goto("/administratif");
  const folders = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mes dossiers" }) });

  // Un dossier peut être créé avant le premier document.
  await folders.getByRole("button", { name: /Nouveau dossier/ }).click();
  await sheet(page).getByLabel("Nom du dossier").fill("Voiture");
  await sheet(page).getByRole("button", { name: "Créer le dossier" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Voiture");

  // Photo détourée puis enregistrée dans le dossier ouvert.
  await page.getByRole("button", { name: "Ajouter un document" }).filter({ visible: true }).first().click();
  const chooser = page.waitForEvent("filechooser");
  await sheet(page).getByRole("button", { name: "Prendre une photo" }).click();
  await (await chooser).setFiles(await tablePhoto(page));
  await expect(sheet(page).getByText("Cocon a repéré la feuille")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Valider la page" }).click();
  await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
  await expect(sheet(page).getByRole("combobox", { name: "Dossier", exact: true }).locator("option:checked")).toHaveText("📁 Voiture");
  await sheet(page).getByRole("button", { name: /Assurances/ }).click();
  await sheet(page).getByLabel("Titre").fill("Carte grise");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("« Carte grise » ajouté dans Assurances et « Voiture »")).toBeVisible();

  // Enregistré pour de vrai : dossier et document après rechargement.
  await page.reload();
  await expect(page.getByText("Dossier · 1 document")).toBeVisible();
  await page.getByRole("button", { name: /Carte grise/ }).click();
  await expect(sheet(page)).toContainText("1 page");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Modifier le dossier" }).click();
  await sheet(page).getByRole("button", { name: "Supprimer le dossier" }).click();
  await sheet(page).getByRole("group").getByRole("button", { name: "Supprimer le dossier" }).click();
  await expect(page.getByText("Dossier supprimé, documents conservés")).toBeVisible();
  await page.reload();
  await expect(folders.getByRole("link", { name: /Voiture/ })).toHaveCount(0);
  await page.goto("/administratif/assurances");
  await expect(page.getByRole("button", { name: /Carte grise/ })).toBeVisible();
});

/**
 * Parcours photo complet, sans dossiers : il doit marcher AVANT comme APRÈS la migration « dossiers »
 * (régression du test sur iPhone : la PR déployée sur une base pas encore migrée ne chargeait rien).
 */
test("photos : appareil photo + 2 photos de la galerie → scan → un PDF de 3 pages enregistré, rouvert, consulté", async ({ page }) => {
  await signUp(page, { prefix: "papiers-photos" });
  await page.goto("/administratif");
  await expect(page.getByText("Range ici tes papiers")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter un document" }).filter({ visible: true }).first().click();

  const camera = page.waitForEvent("filechooser");
  await sheet(page).getByRole("button", { name: "Prendre une photo" }).click();
  await (await camera).setFiles(await tablePhoto(page));
  await sheet(page).getByRole("button", { name: "Valider la page" }).click();
  await expect(sheet(page).getByText("Page 1/1")).toBeVisible();

  const gallery = page.waitForEvent("filechooser");
  await sheet(page).getByRole("button", { name: "Depuis mes photos" }).click();
  await (await gallery).setFiles([await tablePhoto(page), { ...(await tablePhoto(page)), name: "IMG_0043.jpg" }]);
  await sheet(page).getByRole("button", { name: "Valider la page" }).click();
  await sheet(page).getByRole("button", { name: "Valider la page" }).click();
  await expect(sheet(page).getByText("Page 3/3")).toBeVisible();

  await sheet(page).getByRole("button", { name: /Assurances/ }).click();
  await sheet(page).getByLabel("Titre").fill("Constat amiable");
  await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("« Constat amiable » ajouté dans Assurances")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Constat amiable/ }).first().click();
  await expect(sheet(page)).toContainText("constat-amiable.pdf");
  await expect(sheet(page)).toContainText("3 pages");
  const viewed = nextViewerUrl(page);
  await sheet(page).getByRole("button", { name: "Consulter" }).click();
  const url = await viewed;
  expect(url).toContain("/storage/v1/object/sign/documents/");
  const pdf = await page.request.get(url);
  expect(pdf.status()).toBe(200);
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect((bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(3);
});
