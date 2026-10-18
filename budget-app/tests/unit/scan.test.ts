/** Scan sur l'appareil : détection de la feuille, redressement, rendu « document ». */
import { describe, expect, it } from "vitest";
import {
  detectDocumentQuad,
  enhance,
  fullQuad,
  homography,
  isValidQuad,
  otsuThreshold,
  outputSize,
  project,
  scaleQuad,
  toGray,
  warpPerspective,
  type Point,
  type Quad,
  type RgbaImage,
} from "@/lib/admin/scan";

/** Photo synthétique : fond sombre, feuille claire (quadrilatère quelconque), un trait d'encre au centre. */
function photo(width: number, height: number, sheet: Quad, options: { background?: number; paper?: number } = {}): RgbaImage {
  const background = options.background ?? 40;
  const paper = options.paper ?? 235;
  const data = new Uint8ClampedArray(width * height * 4);
  const inside = (x: number, y: number) => {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
      const a = sheet[i];
      const b = sheet[(i + 1) % 4];
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      const s = Math.sign(cross);
      if (s === 0) continue;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = inside(x + 0.5, y + 0.5) ? paper : background;
      const p = (y * width + x) * 4;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
      data[p + 3] = 255;
    }
  }
  return { data, width, height };
}

const near = (a: Point, b: Point, tolerance: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;

describe("scan : détection de la feuille", () => {
  it("le seuil d'Otsu sépare deux populations de gris", () => {
    const gray = new Uint8Array([...new Array(500).fill(30), ...new Array(500).fill(220)]);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });

  it("retrouve les 4 coins d'une feuille droite", () => {
    const sheet: Quad = [
      { x: 60, y: 40 },
      { x: 340, y: 40 },
      { x: 340, y: 360 },
      { x: 60, y: 360 },
    ];
    const image = photo(400, 400, sheet);
    const quad = detectDocumentQuad(toGray(image), 400, 400);
    expect(quad).not.toBeNull();
    quad!.forEach((corner, i) => expect(near(corner, sheet[i], 6)).toBe(true));
    // Coins légèrement rentrés dans la feuille : aucun liseré du fond sur les bords du scan.
    expect(quad![0].x).toBeGreaterThan(60);
    expect(quad![0].y).toBeGreaterThan(40);
    expect(quad![2].x).toBeLessThan(340);
    expect(quad![2].y).toBeLessThan(360);
  });

  it("retrouve les coins d'une feuille de travers (photo prise en biais)", () => {
    const sheet: Quad = [
      { x: 90, y: 30 },
      { x: 330, y: 70 },
      { x: 300, y: 370 },
      { x: 50, y: 330 },
    ];
    const image = photo(400, 400, sheet);
    const quad = detectDocumentQuad(toGray(image), 400, 400);
    expect(quad).not.toBeNull();
    quad!.forEach((corner, i) => expect(near(corner, sheet[i], 7)).toBe(true));
  });

  it("ne propose rien quand rien ne se détache (photo uniforme ou trop petite zone)", () => {
    const uniform = photo(200, 200, fullQuad(200, 200), { paper: 200, background: 200 });
    expect(detectDocumentQuad(toGray(uniform), 200, 200)).toBeNull();
    const tiny: Quad = [
      { x: 90, y: 90 },
      { x: 110, y: 90 },
      { x: 110, y: 110 },
      { x: 90, y: 110 },
    ];
    expect(detectDocumentQuad(toGray(photo(200, 200, tiny)), 200, 200)).toBeNull();
  });

  it("refuse un quadrilatère croisé, minuscule ou hors de l'image", () => {
    const crossed: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(isValidQuad(crossed, 100, 100)).toBe(false);
    expect(isValidQuad(fullQuad(100, 100, 0.45), 100, 100)).toBe(false);
    expect(isValidQuad(scaleQuad(fullQuad(100, 100), 2), 100, 100)).toBe(false);
    expect(isValidQuad(fullQuad(100, 100, 0.05), 100, 100)).toBe(true);
  });
});

describe("scan : redressement", () => {
  it("l'homographie envoie les coins du rectangle sur ceux de la feuille", () => {
    const quad: Quad = [
      { x: 12, y: 8 },
      { x: 210, y: 30 },
      { x: 190, y: 260 },
      { x: 5, y: 240 },
    ];
    const h = homography(quad, 300, 400);
    const corners: [number, number][] = [
      [0, 0],
      [300, 0],
      [300, 400],
      [0, 400],
    ];
    corners.forEach(([u, v], i) => expect(near(project(h, u, v), quad[i], 1e-6)).toBe(true));
  });

  it("des coins alignés sont refusés", () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(() => homography(flat, 10, 10)).toThrow();
  });

  it("la taille de sortie suit les côtés de la feuille, plafonnée", () => {
    expect(outputSize(fullQuad(300, 400), 2400)).toEqual({ width: 300, height: 400 });
    expect(outputSize(fullQuad(3000, 4000), 2400)).toEqual({ width: 1800, height: 2400 });
  });

  it("une feuille de travers redressée ne garde plus de fond sombre", () => {
    const sheet: Quad = [
      { x: 90, y: 30 },
      { x: 330, y: 70 },
      { x: 300, y: 370 },
      { x: 50, y: 330 },
    ];
    const image = photo(400, 400, sheet);
    const quad = detectDocumentQuad(toGray(image), 400, 400)!;
    const { width, height } = outputSize(quad, 2400);
    const flat = warpPerspective(image, quad, width, height);
    expect(flat.width).toBe(width);
    expect(flat.height).toBe(height);
    // À 3 px des bords près (antialiasing), tout est papier.
    let dark = 0;
    for (let y = 3; y < height - 3; y += 1) for (let x = 3; x < width - 3; x += 1) if (flat.data[(y * width + x) * 4] < 150) dark += 1;
    expect(dark).toBe(0);
  });
});

describe("scan : rendu", () => {
  /** Papier éclairé de façon inégale (ombre à droite) avec un trait d'encre. */
  function shadowedPage(): RgbaImage {
    const width = 120;
    const height = 80;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const light = 230 - (x / width) * 110; // 230 à gauche, 120 à droite (ombre)
        const ink = y >= 38 && y <= 41 && x >= 10 && x <= 110;
        const value = ink ? light * 0.25 : light;
        const p = (y * width + x) * 4;
        data[p] = value;
        data[p + 1] = value * 0.98;
        data[p + 2] = value * 0.95;
        data[p + 3] = 255;
      }
    }
    return { data, width, height };
  }

  it("« document » : papier blanc partout (même dans l'ombre), encre noire", () => {
    const page = shadowedPage();
    const out = enhance(page, "document");
    const at = (x: number, y: number) => out.data[(y * page.width + x) * 4];
    expect(at(10, 10)).toBeGreaterThan(240);
    expect(at(110, 10)).toBeGreaterThan(240); // zone d'ombre devenue blanche
    expect(at(30, 39)).toBeLessThan(40);
    expect(at(100, 39)).toBeLessThan(40);
    // Niveaux de gris.
    expect(out.data[(10 * page.width + 10) * 4 + 1]).toBe(at(10, 10));
  });

  it("« couleur » : ombre atténuée, couleurs gardées", () => {
    const page = shadowedPage();
    const out = enhance(page, "couleur");
    const left = out.data[(10 * page.width + 10) * 4];
    const right = out.data[(10 * page.width + 110) * 4];
    expect(Math.abs(left - right)).toBeLessThan(25);
    expect(right).toBeGreaterThan(200);
    // Le bleu reste plus faible que le rouge (teinte du papier conservée).
    expect(out.data[(10 * page.width + 10) * 4 + 2]).toBeLessThanOrEqual(left);
  });

  it("« original » : copie à l'identique, sans toucher la source", () => {
    const page = shadowedPage();
    const out = enhance(page, "original");
    expect(Array.from(out.data)).toEqual(Array.from(page.data));
    expect(out.data).not.toBe(page.data);
  });
});
