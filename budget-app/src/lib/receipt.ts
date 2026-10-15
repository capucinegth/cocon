/**
 * Lecture d'un ticket de caisse : à partir du texte reconnu sur la photo (OCR, sur l'appareil),
 * retrouve le montant payé, et si possible la date et le nom du magasin. Fonction pure, testée.
 *
 * Le texte d'un ticket photographié est imparfait (« T0TAL », « 23, 45 », « € » lu « E ») :
 * la recherche est tolérante, et l'utilisatrice vérifie toujours le résultat avant d'enregistrer.
 */
import { roundCents } from "./format";

export interface ReceiptReading {
  /** Montant payé (euros). */
  amount?: number;
  /** Date du ticket (AAAA-MM-JJ), seulement si elle est plausible (passée, de moins d'un an). */
  date?: string;
  /** Nom du magasin (première ligne lisible du ticket). */
  merchant?: string;
}

/** Montants « 23,45 » / « 1 234.56 » / « 23, 45 » (deux décimales obligatoires). */
const AMOUNT = /(\d{1,3}(?:[ . ]\d{3})+|\d{1,6})\s?[,.]\s?(\d{2})(?!\d)/g;
const MAX_AMOUNT = 100_000;

/** Lignes à ne jamais prendre pour le total payé. */
const EXCLUDED = /TVA|RENDU|MONNAIE|REMISE|ECONOMI|FIDELIT|POINTS?\b|CAGNOTTE|\bHT\b|SOUS[- ]?T|S\/T|AVANTAGE|BON D|PRIX AU|\/KG|\bKG\b|\/L\b/;

/** Mots-clés du total, du plus fiable au moins fiable. */
const KEYWORDS: [RegExp, number][] = [
  [/NET\s*A\s*PAYER|TOTAL\s*(?:A\s*PAYER|TTC|EUR|€)|MONTANT\s*(?:A\s*PAYER|TTC|DU|TOTAL)/, 4],
  [/\bT[O0]T[A4]L\b|\bA\s*PAYER\b/, 3],
  [/\bMONTANT\b|\bPAYE\b|\bREGLE\b/, 2],
  [/\bCB\b|\bCARTE\b|\bVISA\b|\bMASTERCARD\b|\bSANS\s*CONTACT\b|\bESPECES\b|\bPAIEMENT\b/, 1],
];

function normalize(line: string): string {
  return line
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function amountsIn(line: string): number[] {
  const values: number[] = [];
  for (const match of line.matchAll(AMOUNT)) {
    const units = match[1].replace(/[ . ]/g, "");
    const value = roundCents(Number(`${units}.${match[2]}`));
    if (value > 0 && value < MAX_AMOUNT) values.push(value);
  }
  return values;
}

function findAmount(lines: string[]): number | undefined {
  let best: { score: number; amount: number; index: number } | undefined;
  lines.forEach((line, index) => {
    if (EXCLUDED.test(line)) return;
    const score = KEYWORDS.find(([pattern]) => pattern.test(line))?.[1];
    if (!score) return;
    // Montant sur la ligne du mot-clé, sinon sur la ligne suivante (tickets en deux colonnes).
    const amounts = amountsIn(line);
    const next = lines[index + 1];
    const amount = amounts.at(-1) ?? (next && !EXCLUDED.test(next) ? amountsIn(next).at(-1) : undefined);
    if (amount === undefined) return;
    // Meilleur mot-clé ; à égalité, le plus bas sur le ticket (le total vient après les articles).
    if (!best || score > best.score || (score === best.score && index > best.index)) best = { score, amount, index };
  });
  if (best) return best.amount;
  // Sans mot-clé lisible : le plus grand montant hors lignes exclues (le total est le plus grand).
  const all = lines.filter((line) => !EXCLUDED.test(line)).flatMap(amountsIn);
  return all.length ? Math.max(...all) : undefined;
}

function findDate(lines: string[], today: string): string | undefined {
  const oldest = new Date(`${today}T00:00:00Z`);
  oldest.setUTCDate(oldest.getUTCDate() - 366);
  for (const line of lines) {
    for (const match of line.matchAll(/\b(\d{2})[/.-](\d{2})[/.-](\d{4}|\d{2})\b/g)) {
      const [day, month] = [Number(match[1]), Number(match[2])];
      const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const parsed = new Date(`${iso}T00:00:00Z`);
      const valid = parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
      if (valid && iso <= today && parsed >= oldest) return iso;
    }
  }
  return undefined;
}

const NOT_A_NAME = /TICKET|BIENVENUE|MERCI|CAISSE|\bTEL\b|TELEPHONE|SIRET|SIREN|\bTVA\b|WWW|HTTP|@|\d{5}|\d{2}[/.-]\d{2}/;

function findMerchant(rawLines: string[]): string | undefined {
  for (const raw of rawLines.slice(0, 4)) {
    const line = normalize(raw);
    const letters = line.replace(/[^A-Z]/g, "");
    if (letters.length < 3 || letters.length < line.replace(/\s/g, "").length / 2 || NOT_A_NAME.test(line)) continue;
    const clean = raw.replace(/[^\p{L}\p{N}' &-]/gu, " ").replace(/\s+/g, " ").trim();
    // « CARREFOUR MARKET » → « Carrefour Market »
    const titled = clean.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
    return titled.slice(0, 40).trim() || undefined;
  }
  return undefined;
}

export function parseReceipt(text: string, today: string): ReceiptReading {
  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lines = rawLines.map(normalize);
  return {
    amount: findAmount(lines),
    date: findDate(lines, today),
    merchant: findMerchant(rawLines),
  };
}
