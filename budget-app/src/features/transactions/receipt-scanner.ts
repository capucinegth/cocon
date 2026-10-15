/**
 * Lecture d'une photo de ticket de caisse, entièrement sur l'appareil (Tesseract, WebAssembly) :
 * l'image n'est envoyée nulle part et n'est pas conservée. Les fichiers du moteur et du français
 * sont servis par Cocon lui-même (public/ocr), chargés au premier scan puis gardés en cache.
 */
import type { LoggerMessage } from "tesseract.js";

/** Côté le plus long de l'image analysée : assez pour un ticket, rapide sur téléphone. */
const MAX_SIDE = 1800;

/** Réduit la photo et la passe en niveaux de gris contrastés (meilleure lecture, moins de calcul). */
async function prepareImage(file: File): Promise<HTMLCanvasElement | File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.filter = "grayscale(1) contrast(1.4)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    // Navigateur sans createImageBitmap pour ce format : l'image d'origine est lue telle quelle.
    return file;
  }
}

/** Texte reconnu sur la photo. `onProgress` reçoit l'avancement de la lecture (0 → 1). */
export async function readReceiptText(file: File, onProgress?: (ratio: number) => void): Promise<string> {
  const image = await prepareImage(file);
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("fra", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (message: LoggerMessage) => {
      if (message.status === "recognizing text") onProgress?.(message.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
