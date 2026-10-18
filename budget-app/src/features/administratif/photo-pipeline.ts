/**
 * Photos → document (dans le navigateur, rien n'est envoyé avant la confirmation) :
 * orientation corrigée (EXIF), dimensions minimales vérifiées, redimensionnement raisonnable
 * (lisibilité d'abord), détection de la feuille, redressement et rendu « scan », puis assemblage
 * des pages en UN PDF.
 * Les aperçus sont des liens locaux (blob:) révoqués dès qu'ils ne servent plus : aucune copie ne reste.
 */
import { buildPdfFromJpegs, checkPhotoDimensions, fitWithin, MAX_PHOTO_SIDE, sniffFileType } from "@/lib/admin/files";
import { detectDocumentQuad, enhance, fullQuad, outputSize, scaleQuad, toGray, warpPerspective, type Quad, type ScanMode } from "@/lib/admin/scan";
import { uuid } from "@/lib/ids";

/** Photo d'origine (réduite), gardée le temps de l'import pour pouvoir recadrer la page. */
export interface ScanSource {
  blob: Blob;
  /** Aperçu local (blob:), à révoquer avec `releasePages` / `releaseSource`. */
  url: string;
  width: number;
  height: number;
  /** Coins de la feuille trouvés automatiquement (`null` : rien de net, toute la photo par défaut). */
  detected: Quad | null;
}

export interface PhotoPage {
  id: string;
  blob: Blob;
  /** Aperçu local (blob:), à révoquer avec `releasePages`. */
  url: string;
  width: number;
  height: number;
  source: ScanSource;
  quad: Quad;
  mode: ScanMode;
}

/** Qualité JPEG : texte net, fichier raisonnable (≈ 0,5 à 1,5 Mo par page). */
const JPEG_QUALITY = 0.86;
/** Taille de l'image d'analyse : assez pour trouver les bords, assez petite pour être instantanée. */
const DETECTION_SIDE = 400;

export class PhotoError extends Error {}

export async function readHead(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 32).arrayBuffer());
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const heic = sniffFileType(await readHead(file)) === "heic";
    throw new PhotoError(
      heic
        ? "Cette photo HEIC ne peut pas être lue ici. Prends la photo depuis Cocon, ou choisis-la depuis Photos : elle sera convertie automatiquement."
        : "Cette image ne peut pas être lue. Essaie une autre photo.",
    );
  }
}

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new PhotoError("Cette image ne peut pas être préparée sur cet appareil.");
  return { canvas, context };
}

async function toJpeg(canvas: HTMLCanvasElement, quality = JPEG_QUALITY): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new PhotoError("Cette image ne peut pas être préparée sur cet appareil.");
  return blob;
}

/** Une photo (appareil photo, galerie ou fichier image) → photo réduite + coins de la feuille détectés. */
export async function preparePhoto(file: Blob): Promise<ScanSource> {
  const bitmap = await decode(file);
  try {
    const problem = checkPhotoDimensions(bitmap.width, bitmap.height);
    if (problem) throw new PhotoError(problem);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const { canvas, context } = canvas2d(width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await toJpeg(canvas, 0.92);

    const factor = Math.min(1, DETECTION_SIDE / Math.max(width, height));
    const small = canvas2d(Math.max(1, Math.round(width * factor)), Math.max(1, Math.round(height * factor)));
    small.context.drawImage(canvas, 0, 0, small.canvas.width, small.canvas.height);
    const pixels = small.context.getImageData(0, 0, small.canvas.width, small.canvas.height);
    const found = detectDocumentQuad(toGray(pixels), pixels.width, pixels.height);
    const detected = found ? scaleQuad(found, width / pixels.width) : null;
    return { blob, url: URL.createObjectURL(blob), width, height, detected };
  } finally {
    bitmap.close();
  }
}

/** Coins proposés pour une nouvelle page : la feuille détectée, sinon toute la photo. */
export function initialQuad(source: ScanSource): Quad {
  return source.detected ?? fullQuad(source.width, source.height);
}

/** Page scannée : feuille redressée (les coins deviennent un rectangle), puis rendu choisi. */
export async function scanPage(source: ScanSource, quad: Quad, mode: ScanMode, id: string = uuid()): Promise<PhotoPage> {
  const bitmap = await decode(source.blob);
  try {
    const { context } = canvas2d(source.width, source.height);
    context.drawImage(bitmap, 0, 0, source.width, source.height);
    const pixels = context.getImageData(0, 0, source.width, source.height);
    const size = outputSize(quad, MAX_PHOTO_SIDE);
    const flat = enhance(warpPerspective(pixels, quad, size.width, size.height), mode);
    const out = canvas2d(flat.width, flat.height);
    out.context.putImageData(new ImageData(flat.data as Uint8ClampedArray<ArrayBuffer>, flat.width, flat.height), 0, 0);
    const blob = await toJpeg(out.canvas);
    return { id, blob, url: URL.createObjectURL(blob), width: flat.width, height: flat.height, source, quad, mode };
  } finally {
    bitmap.close();
  }
}

/** Assemble les pages, dans l'ordre, en un seul PDF. */
export async function pagesToPdf(pages: PhotoPage[]): Promise<Blob> {
  const jpegs = await Promise.all(pages.map(async (p) => ({ bytes: new Uint8Array(await p.blob.arrayBuffer()), width: p.width, height: p.height })));
  return new Blob([buildPdfFromJpegs(jpegs) as BlobPart], { type: "application/pdf" });
}

export function releaseSource(source: ScanSource) {
  URL.revokeObjectURL(source.url);
}

/** Libère les aperçus des pages et de leurs photos d'origine. */
export function releasePages(pages: PhotoPage[]) {
  for (const page of pages) {
    URL.revokeObjectURL(page.url);
    releaseSource(page.source);
  }
}
