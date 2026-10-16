/**
 * Photos → document (dans le navigateur, rien n'est envoyé avant la confirmation) :
 * orientation corrigée (EXIF), dimensions minimales vérifiées, redimensionnement raisonnable
 * (lisibilité d'abord), puis assemblage des pages en UN PDF.
 * Les aperçus sont des liens locaux (blob:) révoqués dès qu'ils ne servent plus : aucune copie ne reste.
 */
import { buildPdfFromJpegs, checkPhotoDimensions, fitWithin, sniffFileType } from "@/lib/admin/files";
import { uuid } from "@/lib/ids";

export interface PhotoPage {
  id: string;
  blob: Blob;
  /** Aperçu local (blob:), à révoquer avec `releasePages`. */
  url: string;
  width: number;
  height: number;
}

/** Qualité JPEG : texte net, fichier raisonnable (≈ 0,5 à 1,5 Mo par page). */
const JPEG_QUALITY = 0.86;

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

/** Une photo (appareil photo, galerie ou fichier image) → une page JPEG prête à assembler. */
export async function photoToPage(file: Blob): Promise<PhotoPage> {
  const bitmap = await decode(file);
  try {
    const problem = checkPhotoDimensions(bitmap.width, bitmap.height);
    if (problem) throw new PhotoError(problem);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PhotoError("Cette image ne peut pas être préparée sur cet appareil.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new PhotoError("Cette image ne peut pas être préparée sur cet appareil.");
    return { id: uuid(), blob, url: URL.createObjectURL(blob), width, height };
  } finally {
    bitmap.close();
  }
}

/** Assemble les pages, dans l'ordre, en un seul PDF. */
export async function pagesToPdf(pages: PhotoPage[]): Promise<Blob> {
  const jpegs = await Promise.all(pages.map(async (p) => ({ bytes: new Uint8Array(await p.blob.arrayBuffer()), width: p.width, height: p.height })));
  return new Blob([buildPdfFromJpegs(jpegs) as BlobPart], { type: "application/pdf" });
}

export function releasePages(pages: PhotoPage[]) {
  for (const page of pages) URL.revokeObjectURL(page.url);
}
