/**
 * Scan de document sur l'appareil (fonctions pures, sans service externe ni bibliothèque lourde) :
 * détection de la feuille dans la photo, redressement de la perspective (les 4 coins deviennent un
 * rectangle) et rendu « document » (fond blanc, texte net, ombres atténuées).
 *
 * Les images sont des tableaux RGBA (comme `ImageData`) : tout est testable sans navigateur.
 */

export interface Point {
  x: number;
  y: number;
}

/** Coins dans l'ordre : haut-gauche, haut-droite, bas-droite, bas-gauche. */
export type Quad = [Point, Point, Point, Point];

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type ScanMode = "document" | "couleur" | "original";

/* ------------------------------------------------------------------ Détection */

/** Niveaux de gris (luminance). */
export function toGray(image: RgbaImage): Uint8Array {
  const gray = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (image.data[p] * 299 + image.data[p + 1] * 587 + image.data[p + 2] * 114) / 1000;
  }
  return gray;
}

/** Seuil d'Otsu : sépare au mieux les pixels clairs (la feuille) des pixels sombres (le fond). */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (const value of gray) histogram[value] += 1;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function polygonArea(quad: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Quadrilatère utilisable : convexe, dans l'image, et couvrant au moins 4 % de la photo. */
export function isValidQuad(quad: Quad, width: number, height: number): boolean {
  const inside = quad.every((p) => p.x >= -1 && p.y >= -1 && p.x <= width + 1 && p.y <= height + 1);
  if (!inside) return false;
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) return false;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return polygonArea(quad) >= 0.04 * width * height;
}

/** Toute la photo, avec une petite marge facultative (en proportion). */
export function fullQuad(width: number, height: number, inset = 0): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

/**
 * Feuille la plus grande et la plus claire de la photo (sur une image réduite, ≈ 400 px) :
 * seuil d'Otsu, plus grande zone claire d'un seul tenant, puis ses 4 coins extrêmes.
 * `null` si rien de net ne se détache (l'utilisateur ajuste alors les coins lui-même).
 */
export function detectDocumentQuad(gray: Uint8Array, width: number, height: number): Quad | null {
  const size = width * height;
  // Léger flou 3×3 : le bruit de la photo ne crée pas de petites zones parasites.
  const smooth = new Uint8Array(size);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += gray[yy * width + xx];
          count += 1;
        }
      }
      smooth[y * width + x] = sum / count;
    }
  }
  const threshold = otsuThreshold(smooth);
  const bright = new Uint8Array(size);
  let brightCount = 0;
  for (let i = 0; i < size; i += 1) {
    if (smooth[i] > threshold) {
      bright[i] = 1;
      brightCount += 1;
    }
  }
  const fraction = brightCount / size;
  if (fraction < 0.04 || fraction > 0.97) return null;

  // Plus grande zone claire d'un seul tenant (voisinage à 4).
  const label = new Int32Array(size);
  const queue = new Int32Array(size);
  let bestLabel = 0;
  let bestArea = 0;
  let current = 0;
  for (let start = 0; start < size; start += 1) {
    if (!bright[start] || label[start]) continue;
    current += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = current;
    while (head < tail) {
      const i = queue[head++];
      const x = i % width;
      const neighbors = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width];
      for (const n of neighbors) {
        if (n < 0 || n >= size || !bright[n] || label[n]) continue;
        label[n] = current;
        queue[tail++] = n;
      }
    }
    if (tail > bestArea) {
      bestArea = tail;
      bestLabel = current;
    }
  }
  if (bestArea < 0.04 * size) return null;

  let tl = { x: 0, y: 0, s: Infinity };
  let br = { x: 0, y: 0, s: -Infinity };
  let tr = { x: 0, y: 0, s: -Infinity };
  let bl = { x: 0, y: 0, s: Infinity };
  for (let i = 0; i < size; i += 1) {
    if (label[i] !== bestLabel) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x + y < tl.s) tl = { x, y, s: x + y };
    if (x + y > br.s) br = { x, y, s: x + y };
    if (x - y > tr.s) tr = { x, y, s: x - y };
    if (x - y < bl.s) bl = { x, y, s: x - y };
  }
  const corners: Quad = [
    { x: tl.x, y: tl.y },
    { x: tr.x + 1, y: tr.y },
    { x: br.x + 1, y: br.y + 1 },
    { x: bl.x, y: bl.y + 1 },
  ];
  // Légèrement à l'intérieur de la feuille (≈ 1,5 %, comme un scanner) : aucun liseré du fond sur les bords.
  const center = { x: corners.reduce((s, p) => s + p.x, 0) / 4, y: corners.reduce((s, p) => s + p.y, 0) / 4 };
  const quad = corners.map((p) => ({ x: p.x + (center.x - p.x) * EDGE_INSET, y: p.y + (center.y - p.y) * EDGE_INSET })) as Quad;
  return isValidQuad(quad, width, height) ? quad : null;
}

/** Part du chemin vers le centre dont on rentre chaque coin détecté. */
const EDGE_INSET = 0.015;

export function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad;
}

/* ------------------------------------------------------------- Redressement */

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Taille du document redressé : ses côtés les plus longs, réduits si besoin à `maxSide`. */
export function outputSize(quad: Quad, maxSide: number): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  const width = Math.max(distance(tl, tr), distance(bl, br));
  const height = Math.max(distance(tl, bl), distance(tr, br));
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Homographie qui envoie le rectangle de sortie (0,0)-(W,H) sur le quadrilatère de la photo :
 * x = (h0·u + h1·v + h2) / (h6·u + h7·v + 1), y = (h3·u + h4·v + h5) / (h6·u + h7·v + 1).
 */
export function homography(quad: Quad, width: number, height: number): number[] {
  const corners: [number, number][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  const rows: number[][] = [];
  corners.forEach(([u, v], i) => {
    const { x, y } = quad[i];
    rows.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    rows.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  });
  // Élimination de Gauss avec pivot partiel.
  for (let col = 0; col < 8; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < 8; r += 1) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const p = rows[col][col];
    if (Math.abs(p) < 1e-12) throw new Error("Coins alignés : redressement impossible.");
    for (let c = col; c < 9; c += 1) rows[col][c] /= p;
    for (let r = 0; r < 8; r += 1) {
      if (r === col) continue;
      const factor = rows[r][col];
      if (factor === 0) continue;
      for (let c = col; c < 9; c += 1) rows[r][c] -= factor * rows[col][c];
    }
  }
  return rows.map((row) => row[8]);
}

export function project(h: number[], u: number, v: number): Point {
  const w = h[6] * u + h[7] * v + 1;
  return { x: (h[0] * u + h[1] * v + h[2]) / w, y: (h[3] * u + h[4] * v + h[5]) / w };
}

/** Image redressée : chaque pixel de sortie va chercher sa couleur dans la photo (interpolation bilinéaire). */
export function warpPerspective(source: RgbaImage, quad: Quad, width: number, height: number): RgbaImage {
  const h = homography(quad, width, height);
  const out = new Uint8ClampedArray(width * height * 4);
  const { data, width: sw, height: sh } = source;
  const maxX = sw - 1;
  const maxY = sh - 1;
  let o = 0;
  for (let v = 0; v < height; v += 1) {
    const vc = v + 0.5;
    for (let u = 0; u < width; u += 1) {
      const uc = u + 0.5;
      const w = h[6] * uc + h[7] * vc + 1;
      let x = (h[0] * uc + h[1] * vc + h[2]) / w - 0.5;
      let y = (h[3] * uc + h[4] * vc + h[5]) / w - 0.5;
      x = x < 0 ? 0 : x > maxX ? maxX : x;
      y = y < 0 ? 0 : y > maxY ? maxY : y;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = x - x0;
      const fy = y - y0;
      const a = (y0 * sw + x0) * 4;
      const b = (y0 * sw + x1) * 4;
      const c = (y1 * sw + x0) * 4;
      const d = (y1 * sw + x1) * 4;
      for (let k = 0; k < 3; k += 1) {
        const top = data[a + k] + (data[b + k] - data[a + k]) * fx;
        const bottom = data[c + k] + (data[d + k] - data[c + k]) * fx;
        out[o + k] = top + (bottom - top) * fy;
      }
      out[o + 3] = 255;
      o += 4;
    }
  }
  return { data: out, width, height };
}

/* ------------------------------------------------------------------ Rendu */

/** Flou en boîte (rayon r) par image intégrale : estime l'éclairage du papier autour de chaque pixel. */
function boxBlur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += values[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1] - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      out[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/**
 * Rendu du document redressé :
 * - « document » : niveaux de gris, papier blanc, texte noir, ombres et éclairage inégal effacés ;
 * - « couleur » : couleurs gardées, ombres atténuées, papier éclairci ;
 * - « original » : inchangé.
 */
export function enhance(image: RgbaImage, mode: ScanMode): RgbaImage {
  const { width, height } = image;
  const out = new Uint8ClampedArray(image.data);
  if (mode === "original") return { data: out, width, height };
  const size = width * height;
  const luminance = new Float32Array(size);
  for (let i = 0, p = 0; i < size; i += 1, p += 4) luminance[i] = image.data[p] * 0.299 + image.data[p + 1] * 0.587 + image.data[p + 2] * 0.114;
  // Éclairage local du papier : un flou large, que le texte n'influence presque pas.
  const background = boxBlur(luminance, width, height, Math.max(4, Math.round(Math.max(width, height) / 24)));
  for (let i = 0, p = 0; i < size; i += 1, p += 4) {
    const light = Math.max(background[i], 1);
    if (mode === "document") {
      const ratio = luminance[i] / light;
      // Papier (≈ 1) → blanc, encre (≈ 0,5 et moins) → noir, transition douce pour garder les traits fins.
      const value = Math.min(1, Math.max(0, (ratio - 0.5) / (0.9 - 0.5)));
      const gray = 255 * value ** 1.4;
      out[p] = gray;
      out[p + 1] = gray;
      out[p + 2] = gray;
    } else {
      const gain = 245 / light;
      for (let k = 0; k < 3; k += 1) out[p + k] = Math.min(255, image.data[p + k] * gain);
    }
  }
  return { data: out, width, height };
}
