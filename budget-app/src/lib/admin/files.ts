/**
 * Fichiers du module Administratif (fonctions pures) : vérification du VRAI format (premiers octets,
 * pas seulement l'extension), taille, dimensions des photos, nom de stockage sûr,
 * et assemblage de photos JPEG en un PDF (un document = un fichier, quel que soit le nombre de pages).
 */
import { MAX_FILE_BYTES } from "./catalog";

export type SniffedType = "pdf" | "jpeg" | "png" | "webp" | "heic" | "unknown";

/** Un PDF peut avoir quelques octets avant son en-tête « %PDF- » (au plus 1 024, norme PDF). */
const PDF_HEADER_WINDOW = 1024;

/** Format réel d'après les premiers octets du fichier (lire au moins 1 024 octets pour les PDF). */
export function sniffFileType(head: Uint8Array): SniffedType {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  // Signatures d'image en tête de fichier d'abord : une photo n'est jamais prise pour un PDF.
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  // Photos HEIC / HEIF de l'iPhone (marques ISO-BMFF, y compris rafales et séquences).
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|heim|heis|heif|hevc|hevx|hevm|hevs|mif1|msf1)$/.test(ascii(8, 12))) return "heic";
  if (indexOfAscii(head.subarray(0, PDF_HEADER_WINDOW), "%PDF-") >= 0) return "pdf";
  return "unknown";
}

function indexOfAscii(bytes: Uint8Array, needle: string): number {
  const codes = [...needle].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + codes.length <= bytes.length; i += 1) {
    for (let j = 0; j < codes.length; j += 1) if (bytes[i + j] !== codes[j]) continue outer;
    return i;
  }
  return -1;
}

export type FileCheck = { ok: true; kind: "pdf" | "image" } | { ok: false; reason: string };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Fichier choisi par l'utilisateur : PDF ou photo, non vide, 20 Mo au plus. */
export function checkSelectedFile(file: { size: number }, head: Uint8Array): FileCheck {
  if (file.size === 0) return { ok: false, reason: "Ce fichier est vide." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: `Ce fichier fait ${mb(file.size)} : la limite est de 20 Mo.` };
  const type = sniffFileType(head);
  if (type === "pdf") return { ok: true, kind: "pdf" };
  if (type === "unknown") return { ok: false, reason: "Format non pris en charge : choisis un PDF ou une photo (JPEG, PNG, WebP ou HEIC)." };
  return { ok: true, kind: "image" };
}

/** Document final (PDF assemblé ou fichier PDF) : jamais plus de 20 Mo. */
export function checkFinalSize(size: number): string | null {
  return size > MAX_FILE_BYTES ? `Le document fait ${mb(size)} : la limite est de 20 Mo. Retire une page ou choisis un fichier plus léger.` : null;
}

/** Une photo trop petite serait illisible : au moins 500 px sur son plus petit côté. */
export const MIN_PHOTO_SIDE = 500;
export function checkPhotoDimensions(width: number, height: number): string | null {
  return Math.min(width, height) < MIN_PHOTO_SIDE ? "Cette photo est trop petite pour être lisible : reprends-la de plus près." : null;
}

/** Plus grand côté conservé : lisible à l'écran et à l'impression (≈ 200 dpi en A4), sans fichier démesuré. */
export const MAX_PHOTO_SIDE = 2400;
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Nom de fichier sûr pour le stockage (ASCII, sans chemin), avec l'extension voulue. */
export function storageFileName(name: string, extension: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
  return `${base || "document"}.${extension}`;
}

/* --------------------------------------------------------------------- PDF */

export interface JpegPage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Largeur d'une page A4 en points ; la hauteur suit les proportions de la photo. */
const PAGE_WIDTH = 595.28;

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Écrit un PDF à partir d'objets déjà numérotés (1…n), avec sa table de références. */
function writePdf(objects: (string | Uint8Array[])[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n"), new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let length = chunks.reduce((n, c) => n + c.length, 0);
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(length);
    const parts = [encoder.encode(`${index + 1} 0 obj\n`), ...(typeof object === "string" ? [encoder.encode(object)] : object), encoder.encode("\nendobj\n")];
    chunks.push(...parts);
    length += parts.reduce((n, c) => n + c.length, 0);
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  chunks.push(encoder.encode(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return concat(chunks);
}

/** Un PDF d'une page par photo JPEG (dans l'ordre donné), sans recompression. */
export function buildPdfFromJpegs(pages: JpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("Aucune page à assembler.");
  const encoder = new TextEncoder();
  const objects: (string | Uint8Array[])[] = [];
  const pageIds = pages.map((_, i) => 3 + i * 3);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  pages.forEach((page, i) => {
    const [imageId, contentId] = [pageIds[i] + 1, pageIds[i] + 2];
    const w = PAGE_WIDTH;
    const h = Math.round(((PAGE_WIDTH * page.height) / page.width) * 100) / 100;
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push([
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
      ),
      page.bytes,
      encoder.encode("\nendstream"),
    ]);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  return writePdf(objects);
}

/** Petit PDF texte (une page), pour les documents fictifs du mode démo. Caractères latin-1 uniquement. */
export function buildTextPdf(lines: string[]): Uint8Array {
  const escape = (text: string) =>
    [...text.normalize("NFC")]
      .map((ch) => (ch.charCodeAt(0) < 256 ? ch : "?"))
      .join("")
      .replace(/[\\()]/g, (c) => `\\${c}`);
  const body = lines.map((line, i) => `BT /F1 ${i === 0 ? 20 : 13} Tf 64 ${760 - i * 30} Td (${escape(line)}) Tj ET`).join("\n");
  const latin1 = (text: string) => Uint8Array.from([...text].map((c) => c.charCodeAt(0) & 0xff));
  return writePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    [latin1(`<< /Length ${latin1(body).length} >>\nstream\n`), latin1(body), latin1("\nendstream")],
  ]);
}
