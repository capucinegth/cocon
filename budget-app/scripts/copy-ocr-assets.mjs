#!/usr/bin/env node
/**
 * Copie les fichiers de reconnaissance de texte (Tesseract) dans public/ocr, pour que la lecture
 * des tickets de caisse se fasse entièrement depuis Cocon (aucun CDN tiers, rien n'est envoyé).
 * Lancé automatiquement avant `next dev` et `next build` ; public/ocr n'est pas versionné.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
mkdirSync(out, { recursive: true });

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const tesseract = pkgDir("tesseract.js");
const core = pkgDir("tesseract.js-core");
const fra = pkgDir("@tesseract.js-data/fra");

const files = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  // Moteur LSTM (seul utilisé) : le navigateur charge la variante adaptée à ses capacités.
  [join(core, "tesseract-core-lstm.wasm.js"), "tesseract-core-lstm.wasm.js"],
  [join(core, "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [join(core, "tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract-core-relaxedsimd-lstm.wasm.js"],
  // Français, modèle compact (« best_int ») : bonne précision, ~0,7 Mo.
  [join(fra, "4.0.0_best_int", "fra.traineddata.gz"), "fra.traineddata.gz"],
];
for (const [from, name] of files) copyFileSync(from, join(out, name));
console.log(`OCR : ${files.length} fichiers copiés dans public/ocr`);
