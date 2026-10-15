/**
 * Scan d'un ticket de caisse dans un vrai navigateur : l'OCR (Tesseract, servi par Cocon depuis /ocr)
 * lit une image de ticket générée pour le test, puis le formulaire est pré-rempli.
 */
import { expect, test, type Page } from "@playwright/test";
import { heroAmount, openAdd, sheet } from "../support";

/** Image PNG d'un ticket (rendue par le navigateur, comme une photo bien cadrée). */
async function receiptImage(page: Page): Promise<Buffer> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 520, height: 760 });
  await other.setContent(`
    <body style="margin:0;background:#fff">
      <pre style="font:24px/1.5 'DejaVu Sans Mono', monospace;color:#111;padding:28px;margin:0">
MONOPRIX
12/09/2026 18:42
PAIN DE MIE          1,89
LAIT DEMI ECREME     2,35
POMMES               3,58
SOUS-TOTAL           7,82
TOTAL TTC            7,82 EUR
CB                   7,82
TVA 5,5%             0,41
      </pre>
    </body>`);
  const buffer = await other.screenshot({ type: "png" });
  await other.close();
  return buffer;
}

test("scanner un ticket : montant, magasin et date pré-remplis, à vérifier", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lecture OCR testée une fois (même moteur sur mobile).");
  test.setTimeout(120_000);
  const image = await receiptImage(page);
  await page.goto("/");
  await openAdd(page);
  await expect(sheet(page).getByRole("button", { name: "Scanner un ticket" })).toBeVisible();
  await sheet(page).getByTestId("receipt-input").setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: image });
  await expect(sheet(page).getByText(/Ticket lu : 7,82/).last()).toBeVisible({ timeout: 90_000 });
  await expect(sheet(page).getByLabel("Montant en euros")).toHaveValue("7,82");
  await expect(sheet(page).getByLabel(/Description/)).toHaveValue("Monoprix");
  // 12 septembre (veille du jour de la démo) : « Hier ».
  await expect(sheet(page).getByRole("button", { name: "Hier" })).toHaveAttribute("aria-pressed", "true");
  await sheet(page).getByRole("button", { name: /Courses/ }).first().click();
  await sheet(page).getByRole("button", { name: /^Ajouter −7,82/ }).click();
  await expect.poll(() => heroAmount(page)).toBe("635,38 €"); // 643,20 − 7,82 : la dépense est déduite du disponible
});

test("le bouton n'est proposé que pour une dépense", async ({ page }) => {
  await page.goto("/");
  await openAdd(page);
  await expect(sheet(page).getByRole("button", { name: "Scanner un ticket" })).toBeVisible();
  await sheet(page).getByRole("radio", { name: "Revenu" }).click();
  await expect(sheet(page).getByRole("button", { name: "Scanner un ticket" })).toHaveCount(0);
});
