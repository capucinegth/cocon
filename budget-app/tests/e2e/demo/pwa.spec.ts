/** Application installable : manifeste, icônes, service worker et page hors connexion. */
import { expect, test } from "@playwright/test";

test("manifeste et icônes", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ short_name: "Cocon", lang: "fr", display: "standalone", start_url: "/", theme_color: "#fff8fa" });
  for (const icon of manifest.icons as { src: string; purpose: string }[]) {
    const image = await request.get(icon.src);
    expect(image.ok(), icon.src).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
  }
  expect((manifest.icons as { purpose: string }[]).some((icon) => icon.purpose === "maskable")).toBe(true);
  expect((await request.get("/apple-icon.png")).ok()).toBe(true);
});

test("hors connexion : page d'explication au lieu d'une erreur du navigateur", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Une seule vérification suffit.");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  // Coupure du serveur simulée au niveau du contexte (les requêtes du service worker y passent aussi).
  await context.route("**/budget", (route) => route.abort("internetdisconnected"));
  await page.goto("/budget").catch(() => {});
  await expect(page.getByRole("heading", { name: "Tu es hors connexion" })).toBeVisible();
  await context.unroute("**/budget");
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByRole("heading", { name: /^Budget/ })).toBeVisible();
});
