/** Inscription, connexion, déconnexion, pages protégées, session expirée. */
import { expect, test } from "@playwright/test";
import { logIn, PASSWORD, signUp, uniqueEmail } from "./helpers";

test("les pages de l'application sont protégées", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Ftransactions/);
  await expect(page.getByRole("heading", { name: "Bon retour 👋" })).toBeVisible();
});

test("inscription : compte prêt, accueil personnalisé et premiers pas", async ({ page }) => {
  await signUp(page, { name: "Camille" });
  await expect(page.getByRole("heading", { name: "Bonjour Camille 👋" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bienvenue dans Cocon, Camille" })).toBeVisible();
  await expect(page.getByText("Commence par ajouter ton premier revenu ou ta première dépense.")).toBeVisible();
  await expect(page.getByText("À démarrer")).toBeVisible();
  // Déjà connecté : la page de connexion renvoie vers l'application.
  await page.goto("/connexion");
  await expect(page).toHaveURL(/\/$/);
});

test("déconnexion puis reconnexion vers la page demandée", async ({ page }) => {
  const email = await signUp(page);
  await page.goto("/parametres");
  await page.getByRole("button", { name: /Se déconnecter/ }).click();
  await expect(page).toHaveURL(/\/connexion\?raison=deconnexion/);
  await expect(page.getByText("Déconnexion réussie. À bientôt !")).toBeVisible();
  await page.goto("/budget");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fbudget/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/budget$/);
});

test("erreurs de connexion et d'inscription en français", async ({ page }) => {
  const email = await signUp(page);
  await page.context().clearCookies();
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("E-mail ou mot de passe incorrect.");

  await page.goto("/inscription");
  await page.getByLabel("Adresse e-mail").fill(uniqueEmail("court"));
  await page.getByLabel("Mot de passe", { exact: true }).fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Le mot de passe doit contenir au moins 8 caractères.");

  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Un compte existe déjà avec cette adresse. Connecte-toi plutôt.");
});

test("session expirée ou invalide : retour à la connexion avec un message clair", async ({ page, context }) => {
  await signUp(page);
  const cookies = await context.cookies();
  const auth = cookies.filter((c) => c.name.includes("-auth-token"));
  expect(auth.length).toBeGreaterThan(0);
  // Jeton corrompu (comme une session révoquée ou expirée sans rafraîchissement possible).
  await context.addCookies(auth.map((c) => ({ ...c, value: "base64-eyJpbnZhbGlkIjp0cnVlfQ" })));
  await page.goto("/objectifs");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fobjectifs&raison=session/);
  await expect(page.getByText("Ta session a expiré. Reconnecte-toi pour retrouver tes données.")).toBeVisible();
});

test("la session persiste après fermeture de l'onglet", async ({ page, context }) => {
  const email = await signUp(page, { name: "Inès" });
  await page.close();
  const again = await context.newPage();
  await again.goto("/");
  await expect(again.getByRole("heading", { name: "Bonjour Inès 👋" })).toBeVisible();
  expect(email).toContain("@test.local");
});

test("connexion d'un compte existant depuis un navigateur vierge", async ({ page, browser }) => {
  const email = await signUp(page, { name: "Noa" });
  const context = await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" });
  const other = await context.newPage();
  await logIn(other, email);
  await expect(other.getByRole("heading", { name: "Bonjour Noa 👋" })).toBeVisible();
  await context.close();
});
