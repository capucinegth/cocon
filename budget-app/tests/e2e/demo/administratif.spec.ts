/**
 * Module « Mes papiers » (mode démo, documents fictifs) : accueil, recherche, filtres,
 * import par photo (une ou plusieurs pages) ou fichier, refus propres, fiche, échéances, suppression.
 */
import { expect, test, type Page } from "@playwright/test";
import { clean, expectNoA11yViolations, heroAmount, navigate, sheet } from "../support";

/** Photo de document générée par le navigateur (comme une photo prise avec le téléphone). */
async function photo(page: Page, label: string, width = 900, height = 1200): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width, height });
  await other.setContent(`<body style="margin:0;background:#fffdf8;font:32px sans-serif;padding:60px">${label}<hr><p>Texte du document</p></body>`);
  const buffer = await other.screenshot({ type: "jpeg", quality: 80 });
  await other.close();
  return { name: `IMG_${label.replace(/\W/g, "")}.jpg`, mimeType: "image/jpeg", buffer };
}

/** Photo d'une feuille posée de travers sur une table sombre (comme une vraie photo de papier). */
async function tablePhoto(page: Page, label: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 900, height: 1200 });
  await other.setContent(
    `<body style="margin:0;height:1200px;background:#3b332d;display:grid;place-items:center;overflow:hidden">` +
      `<div style="width:560px;height:780px;background:#fbf8f1;transform:rotate(7deg);font:30px sans-serif;padding:50px;box-sizing:border-box">${label}<hr><p>Texte du document</p></div></body>`,
  );
  const buffer = await other.screenshot({ type: "jpeg", quality: 85 });
  await other.close();
  return { name: `IMG_${label.replace(/\W/g, "")}.jpg`, mimeType: "image/jpeg", buffer };
}

/** Valide le détourage proposé pour chaque nouvelle photo. */
async function validateScans(page: Page, count = 1) {
  for (let i = 0; i < count; i += 1) {
    await expect(sheet(page).getByRole("heading", { name: /Ajuste les bords de la page/ })).toBeVisible();
    await sheet(page).getByRole("button", { name: /^(Valider la page|Remplacer la page)$/ }).click();
  }
  await expect(sheet(page).getByRole("heading", { name: /Ajuste les bords de la page/ })).toHaveCount(0);
}

const pdf = (name: string, size = 0) => {
  const head = Buffer.from("%PDF-1.4\n% document de test\n%%EOF\n");
  return { name, mimeType: "application/pdf", buffer: size > head.length ? Buffer.concat([head, Buffer.alloc(size - head.length)]) : head };
};

/** Ouvre « Ajouter un document » et choisit la source (un bouton ouvre le sélecteur de fichiers du système). */
async function importFrom(page: Page, source: "Prendre une photo" | "Choisir une photo" | "Choisir un fichier" | "Ajouter une page" | "Depuis mes photos" | "Reprendre la photo", files: Parameters<import("@playwright/test").FileChooser["setFiles"]>[0]) {
  const chooser = page.waitForEvent("filechooser");
  await sheet(page).getByRole("button", { name: source }).click();
  const fileChooser = await chooser;
  await fileChooser.setFiles(files);
  return fileChooser;
}

async function openImport(page: Page) {
  await page.getByRole("button", { name: "Ajouter un document" }).filter({ visible: true }).first().click();
  await expect(sheet(page).getByRole("heading", { name: "Ajouter un document" })).toBeVisible();
}

test.describe("Mes papiers", () => {
  test("accueil simple : à faire, mes documents, ajouts récents ; navigation", async ({ page }) => {
    await page.goto("/");
    await navigate(page, "/administratif");
    await expect(page.getByRole("heading", { level: 1, name: "Mes papiers" })).toBeVisible();
    const main = clean(await page.locator("main").innerText());
    for (const text of ["À faire", "Paiement du solde d'impôt", "dans 2 jours", "Mes documents", "Professionnel", "Santé", "Impôts", "Assurances", "Ajouts récents"]) {
      expect(main).toContain(text);
    }
    // Pas de tableau de bord chiffré, ni de doublon entre « À faire » et « Ajouts récents ».
    const recent = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ajouts récents" }) });
    await expect(recent).not.toContainText("À vérifier");
    await expectNoA11yViolations(page);
    // Le Budget n'est pas touché par le module.
    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
  });

  test("recherche locale : salaire, assurance voiture, impôt, année", async ({ page }) => {
    await page.goto("/administratif");
    const search = page.getByRole("searchbox", { name: "Rechercher un document" });
    const results = page.locator("section").filter({ has: page.getByRole("heading", { name: "Résultats" }) });
    await search.fill("salaire");
    await expect(results.getByRole("button", { name: /Fiche de paie · août 2026/ })).toBeVisible();
    await expect(results.getByRole("listitem")).toHaveCount(1);
    await search.fill("assurance voiture");
    await expect(results.getByRole("button", { name: /Assurance automobile/ })).toBeVisible();
    await search.fill("impôt");
    await expect(results.getByRole("button", { name: /Avis d'imposition/ })).toBeVisible();
    await search.fill("lumiere");
    await expect(results.getByRole("listitem")).toHaveCount(1);
    await search.fill("zzz");
    await expect(results.getByText("Rien trouvé")).toBeVisible();
    await page.getByRole("button", { name: "Effacer la recherche" }).click();
    await expect(page.getByRole("heading", { name: "Mes documents" })).toBeVisible();
  });

  test("catégorie : filtres type, année et « à vérifier »", async ({ page }) => {
    await page.goto("/administratif/professionnel");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Professionnel");
    await expect(page.getByText("2 documents")).toBeVisible();
    await page.getByLabel("Type de document").selectOption({ label: "Contrat de travail" });
    await expect(page.getByText("1 document", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Contrat de travail \(CDI\)/ })).toBeVisible();
    await page.getByLabel("Type de document").selectOption({ label: "Tous les types" });
    await page.getByRole("button", { name: "À vérifier", exact: true }).click();
    await expect(page.getByRole("button", { name: /Fiche de paie · août 2026/ })).toBeVisible();
    await expect(page.getByText("1 document", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "À vérifier", exact: true }).click();
    await page.getByLabel("Année").selectOption("2024");
    await expect(page.getByText("1 document", { exact: true })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});

test.describe("Ajouter un document", () => {
  test("photo d'une page : appareil photo, aperçu, reprise, classement, enregistrement", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    const chooser = await importFrom(page, "Prendre une photo", await photo(page, "Attestation employeur"));
    // L'appareil photo arrière est demandé directement.
    expect(await chooser.element().getAttribute("capture")).toBe("environment");
    await validateScans(page);
    await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Agrandir la page 1" }).click();
    await expect(sheet(page).getByRole("img", { name: "Page 1 sur 1" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Fermer l'aperçu" }).click();
    await importFrom(page, "Reprendre la photo", await photo(page, "Attestation reprise"));
    await validateScans(page);
    await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
    await expectNoA11yViolations(page);

    // Une photo ne donne pas de classement : rien n'est inventé, l'utilisateur choisit.
    await expect(sheet(page).getByRole("button", { name: "Choisis une catégorie" })).toBeDisabled();
    await sheet(page).getByRole("button", { name: /Professionnel/ }).click();
    await sheet(page).getByLabel("Type de document").selectOption({ label: "Attestation employeur" });
    await sheet(page).getByLabel("Titre").fill("Attestation employeur 2026");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Attestation employeur 2026 » ajouté dans Professionnel")).toBeVisible();

    await page.getByRole("button", { name: /Attestation employeur 2026/ }).first().click();
    await expect(sheet(page)).toContainText("1 page");
    await expect(sheet(page)).toContainText("attestation-employeur-2026.pdf");
  });

  test("document de plusieurs pages : ajouter, réorganiser, supprimer une page, un seul document", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    await importFrom(page, "Prendre une photo", await photo(page, "Page A"));
    await validateScans(page);
    await importFrom(page, "Ajouter une page", await photo(page, "Page B"));
    await validateScans(page);
    await importFrom(page, "Depuis mes photos", [await photo(page, "Page C"), await photo(page, "Page D")]);
    await expect(sheet(page).getByRole("heading", { name: /Photo 1 sur 2/ })).toBeVisible();
    await validateScans(page, 2);
    for (const label of ["Page 1/4", "Page 2/4", "Page 3/4", "Page 4/4"]) await expect(sheet(page).getByText(label)).toBeVisible();
    await sheet(page).getByRole("button", { name: "Placer la page 1 après" }).click();
    await sheet(page).getByRole("button", { name: "Supprimer la page 4" }).click();
    await expect(sheet(page).getByText("Page 3/3")).toBeVisible();
    await expect(sheet(page).getByText("Page 4/4")).toHaveCount(0);
    await sheet(page).getByRole("button", { name: /Santé/ }).click();
    await sheet(page).getByLabel("Type de document").selectOption({ label: "Ordonnance" });
    await sheet(page).getByLabel("Titre").fill("Ordonnance du docteur");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Ordonnance du docteur » ajouté dans Santé")).toBeVisible();
    await navigate(page, "/administratif");
    await page.getByRole("link", { name: /Santé/ }).click();
    await page.getByRole("button", { name: /Ordonnance du docteur/ }).click();
    await expect(sheet(page)).toContainText("3 pages");
  });

  test("fichier PDF : classement proposé d'après le nom, à vérifier puis validé", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    await importFrom(page, "Choisir un fichier", pdf("bulletin_salaire_septembre_2026.pdf"));
    await expect(sheet(page).getByText("Classement proposé d'après le nom du fichier")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /Professionnel/ })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page).getByLabel("Type de document")).toHaveValue("fiche_paie");
    await expect(sheet(page).getByLabel("Mois")).toHaveValue("9");
    await expect(sheet(page).getByLabel("Année")).toHaveValue("2026");
    await expect(sheet(page).getByLabel("Titre")).toHaveValue("Fiche de paie · septembre 2026");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/ajouté dans Professionnel/)).toBeVisible();

    await page.getByRole("button", { name: /Fiche de paie · septembre 2026/ }).first().click();
    // La période lue dans le nom est une information « à vérifier », jamais considérée comme certaine.
    await expect(sheet(page).getByRole("button", { name: "Valider : Mois" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Valider : Mois" }).click();
    await expect(sheet(page).getByRole("button", { name: "Valider : Mois" })).toHaveCount(0);
    await expect(sheet(page).getByText("Validée").first()).toBeVisible();
    // Une information saisie par l'utilisateur est validée ; rien n'est envoyé dans le budget.
    await sheet(page).getByRole("button", { name: "Ajouter : Salaire net" }).click();
    await sheet(page).getByLabel("Salaire net en euros").fill("1850");
    await sheet(page).getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(sheet(page)).toContainText("1 850 €");
    await page.keyboard.press("Escape");
    await navigate(page, "/");
    await expect.poll(() => heroAmount(page)).toBe("643,20 €");
  });

  test("refus propres : format interdit, plus de 20 Mo, photo trop petite ; annulation", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    await importFrom(page, "Choisir un fichier", { name: "programme.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ\x90\x00binaire") });
    await expect(sheet(page).getByText(/Format non pris en charge/)).toBeVisible();
    await importFrom(page, "Choisir un fichier", pdf("enorme.pdf", 20 * 1024 * 1024 + 10));
    await expect(sheet(page).getByText(/la limite est de 20 Mo/)).toBeVisible();
    // Moins de 500 px de côté, même sur un écran haute densité (×2).
    await importFrom(page, "Choisir une photo", await photo(page, "petite", 200, 150));
    await expect(sheet(page).getByText(/trop petite pour être lisible/)).toBeVisible();
    // Toujours au choix de la source : rien n'a été ajouté.
    await expect(sheet(page).getByRole("button", { name: "Prendre une photo" })).toBeVisible();

    // Une photo écartée au détourage n'ajoute rien.
    await importFrom(page, "Choisir une photo", await photo(page, "Ecartee"));
    await sheet(page).getByRole("button", { name: "Écarter" }).click();
    await expect(sheet(page).getByRole("button", { name: "Prendre une photo" })).toBeVisible();

    await importFrom(page, "Choisir une photo", await photo(page, "A annuler"));
    await validateScans(page);
    await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Annuler" }).click();
    await expect(sheet(page).getByRole("button", { name: "Prendre une photo" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("button", { name: /Document du/ })).toHaveCount(0);
  });
});

test.describe("Scan d'une photo", () => {
  test("feuille de travers sur une table : détourée, redressée, rendu document, recadrage", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    await importFrom(page, "Prendre une photo", await tablePhoto(page, "Avis de soins"));
    await expect(sheet(page).getByText("Cocon a repéré la feuille")).toBeVisible();
    await expect(sheet(page).getByRole("radio", { name: "Document" })).toHaveAttribute("aria-checked", "true");

    // Les coins proposés sont sur la feuille, pas aux coins de la photo.
    const frame = await sheet(page).getByRole("img", { name: "Photo à détourer" }).boundingBox();
    const corner = await sheet(page).getByTestId("scan-corner-0").boundingBox();
    expect(frame && corner).toBeTruthy();
    const relX = (corner!.x + corner!.width / 2 - frame!.x) / frame!.width;
    const relY = (corner!.y + corner!.height / 2 - frame!.y) / frame!.height;
    expect(relX).toBeGreaterThan(0.12);
    expect(relY).toBeGreaterThan(0.08);
    await expectNoA11yViolations(page);

    // Coin déplacé au clavier, puis retour aux bords repérés.
    await sheet(page).getByTestId("scan-corner-0").focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(sheet(page).getByRole("button", { name: "Bords repérés" })).toBeVisible();
    await sheet(page).getByRole("button", { name: "Bords repérés" }).click();
    await expect(sheet(page).getByRole("button", { name: "Bords repérés" })).toHaveCount(0);

    await sheet(page).getByRole("button", { name: "Valider la page" }).click();
    await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
    // La page redressée a les proportions de la feuille (560 × 780), pas celles de la photo (900 × 1200).
    const ratio = await sheet(page)
      .locator("ol img")
      .first()
      .evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
    expect(ratio).toBeGreaterThan(0.66);
    expect(ratio).toBeLessThan(0.78);
    // Rendu « document » : le fond de la table a disparu, la page est blanche.
    const corners = await sheet(page)
      .locator("ol img")
      .first()
      .evaluate((img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(img, 0, 0);
        const at = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[0];
        const m = 12;
        return [at(m, m), at(canvas.width - m, m), at(canvas.width - m, canvas.height - m), at(m, canvas.height - m)];
      });
    for (const value of corners) expect(value).toBeGreaterThan(200);

    // Recadrer une page déjà ajoutée : rendu « Couleur ».
    await sheet(page).getByRole("button", { name: "Recadrer la page 1" }).click();
    await sheet(page).getByRole("radio", { name: "Couleur" }).click();
    await sheet(page).getByRole("button", { name: "Toute la photo" }).click();
    await sheet(page).getByRole("button", { name: "Valider", exact: true }).click();
    await expect(sheet(page).getByText("Page 1/1")).toBeVisible();
    const fullRatio = await sheet(page)
      .locator("ol img")
      .first()
      .evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
    expect(fullRatio).toBeCloseTo(900 / 1200, 1);
  });
});

test.describe("Mes dossiers", () => {
  test("créer, ouvrir, ranger un document, renommer, supprimer (documents gardés)", async ({ page }) => {
    await page.goto("/administratif");
    const folders = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mes dossiers" }) });
    await expect(folders.getByRole("link", { name: /Appartement/ })).toContainText("1 document");

    // Création : nom déjà pris refusé (sans tenir compte des majuscules), puis nouveau dossier.
    await folders.getByRole("button", { name: /Nouveau dossier/ }).click();
    await expect(sheet(page).getByRole("heading", { name: "Nouveau dossier" })).toBeVisible();
    await sheet(page).getByLabel("Nom du dossier").fill(" appartement ");
    await expect(sheet(page).getByText("Un dossier porte déjà ce nom.")).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Créer le dossier" })).toBeDisabled();
    await sheet(page).getByLabel("Nom du dossier").fill("Voiture");
    await sheet(page).getByRole("radio", { name: "🚗" }).click();
    await expectNoA11yViolations(page);
    await sheet(page).getByRole("button", { name: "Créer le dossier" }).click();
    await expect(page.getByText("Dossier « Voiture » créé")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("🚗 Voiture");
    await expect(page.getByText("Ce dossier est vide")).toBeVisible();
    await expectNoA11yViolations(page);

    // Ranger un document existant depuis sa fiche : il garde sa catégorie.
    // (Mode démo : données en mémoire, on navigue par les liens de l'application.)
    await page.getByRole("link", { name: "Mes papiers" }).filter({ visible: true }).first().click();
    await page.getByRole("link", { name: /Assurances/ }).click();
    await page.getByRole("button", { name: /Assurance automobile/ }).click();
    await sheet(page).getByRole("combobox", { name: "Dossier", exact: true }).selectOption({ label: "🚗 Voiture" });
    await expect(page.getByText("Rangé dans « Voiture »")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Assurance automobile/ })).toBeVisible();

    // Ajouter un document directement dans le dossier ouvert.
    await page.getByRole("link", { name: "Mes papiers" }).filter({ visible: true }).first().click();
    await folders.getByRole("link", { name: /Voiture/ }).click();
    await expect(page.getByRole("button", { name: /Assurance automobile/ })).toBeVisible();
    await openImport(page);
    await importFrom(page, "Choisir un fichier", pdf("carte_grise.pdf"));
    await expect(sheet(page).getByRole("combobox", { name: "Dossier", exact: true }).locator("option:checked")).toHaveText("🚗 Voiture");
    await sheet(page).getByRole("button", { name: /Assurances/ }).click();
    await sheet(page).getByLabel("Titre").fill("Carte grise");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("« Carte grise » ajouté dans Assurances et « Voiture »")).toBeVisible();
    await expect(page.getByRole("button", { name: /Carte grise/ })).toBeVisible();
    await expect(page.getByText("Dossier · 2 documents")).toBeVisible();

    // La recherche de l'accueil trouve par nom de dossier.
    await page.getByRole("link", { name: "Mes papiers" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Mes papiers" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Rechercher un document" }).fill("voiture");
    const results = page.locator("section").filter({ has: page.getByRole("heading", { name: "Résultats" }) });
    await expect(results.getByRole("button", { name: /Carte grise/ })).toBeVisible();
    await page.getByRole("button", { name: "Effacer la recherche" }).click();

    // Renommer, puis supprimer : les documents restent dans leurs catégories.
    await folders.getByRole("link", { name: /Voiture/ }).click();
    await page.getByRole("button", { name: "Modifier le dossier" }).click();
    await sheet(page).getByLabel("Nom du dossier").fill("Ma voiture");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ma voiture");
    await page.getByRole("button", { name: "Modifier le dossier" }).click();
    await sheet(page).getByRole("button", { name: "Supprimer le dossier" }).click();
    await expect(sheet(page).getByText(/Les 2 documents qu'il contient restent dans Mes papiers/)).toBeVisible();
    await sheet(page).getByRole("group").getByRole("button", { name: "Supprimer le dossier" }).click();
    await expect(page.getByText("Dossier supprimé, documents conservés")).toBeVisible();
    await expect(page).toHaveURL(/\/administratif$/);
    await expect(folders.getByRole("link", { name: /voiture/i })).toHaveCount(0);
    await page.getByRole("link", { name: /Assurances/ }).click();
    await expect(page.getByRole("button", { name: /Carte grise/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Assurance automobile/ })).toBeVisible();
  });

  test("nouveau dossier créé depuis l'import, document rangé dedans", async ({ page }) => {
    await page.goto("/administratif");
    await openImport(page);
    await importFrom(page, "Choisir un fichier", pdf("avis_impot_2026.pdf"));
    await sheet(page).getByRole("button", { name: "Nouveau dossier" }).click();
    await sheet(page).getByLabel("Nom du nouveau dossier").fill("Impôts de la famille");
    await sheet(page).getByRole("button", { name: "Créer le dossier" }).click();
    await expect(sheet(page).getByRole("combobox", { name: "Dossier", exact: true }).locator("option:checked")).toHaveText("📁 Impôts de la famille");
    await sheet(page).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText(/ajouté dans Impôts et « Impôts de la famille »/)).toBeVisible();
    const folders = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mes dossiers" }) });
    await expect(folders.getByRole("link", { name: /Impôts de la famille/ })).toContainText("1 document");
  });
});

test.describe("Fiche d'un document", () => {
  test("consulter, télécharger, échéance, traitée, suppression", async ({ page }) => {
    await page.goto("/administratif/assurances");
    await page.getByRole("button", { name: /Assurance habitation/ }).click();
    await expect(sheet(page)).toContainText("Cocon Assurances");
    await expectNoA11yViolations(page);

    // L'onglet s'ouvre pendant le geste (exigence de l'iPhone), puis reçoit le fichier par un lien temporaire :
    // un navigateur avec lecteur PDF l'affiche, le Chromium sans interface des tests le télécharge.
    const opened = new Promise<string>((resolve) =>
      page.context().once("page", (viewer) => {
        viewer.once("download", () => resolve("téléchargé"));
        viewer.waitForURL(/^blob:/).then(() => resolve("affiché"), () => {});
      }),
    );
    await sheet(page).getByRole("button", { name: "Consulter" }).click();
    expect(["affiché", "téléchargé"]).toContain(await opened);
    const download = page.waitForEvent("download");
    await sheet(page).getByRole("button", { name: "Télécharger" }).click();
    expect((await download).suggestedFilename()).toBe("assurance_habitation.pdf");

    await sheet(page).getByRole("button", { name: "Ajouter une échéance" }).click();
    await sheet(page).getByLabel("Nom de l'échéance").fill("Résiliation possible");
    await sheet(page).getByLabel("Date de l'échéance").fill("2026-11-20");
    await sheet(page).getByRole("button", { name: "Enregistrer l'échéance" }).click();
    await expect(sheet(page)).toContainText("Résiliation possible");
    await expect(sheet(page)).toContainText("20 novembre 2026");
    await sheet(page).getByRole("button", { name: "Résiliation possible : traitée" }).click();
    await expect(sheet(page).getByRole("button", { name: "Résiliation possible : traitée" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    await navigate(page, "/administratif");
    await page.getByRole("link", { name: "Échéances" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Échéances" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dans les 7 jours" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dans les 30 jours" })).toBeVisible();
    // Une échéance traitée ne figure plus parmi les prochaines (la fiche refermée reste dans la page, invisible).
    await expect(page.getByText("Résiliation possible").filter({ visible: true })).toHaveCount(0);
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: /Échéance assurance habitation/ }).click();
    await sheet(page).getByRole("button", { name: "Supprimer le document" }).click();
    await sheet(page).getByRole("button", { name: "Supprimer", exact: true }).click();
    await expect(page.getByText("Document supprimé")).toBeVisible();
    await expect(page.getByRole("button", { name: /Échéance assurance habitation/ })).toHaveCount(0);
  });
});
