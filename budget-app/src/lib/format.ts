/**
 * Formatage des montants « à la française », écrit à la main pour donner
 * exactement le même rendu côté serveur et navigateur (pas d'écart d'hydratation).
 *   2100      → « 2 100 € »
 *   1156.8    → « 1 156,80 € »
 *   -23.5     → « −23,50 € »
 */

const NBSP = "\u00A0"; // espace insécable avant €
const GROUP = "\u00A0"; // espace insécable (milliers, %) — la fine U+202F est quasi invisible avec cette police
const MINUS = "\u2212"; // vrai signe moins

export type SignDisplay = "auto" | "always" | "never";
export type CentsDisplay = "auto" | "always" | "never";

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasCents(value: number): boolean {
  return Math.round(Math.abs(value) * 100) % 100 !== 0;
}

export function formatNumber(value: number, decimals = 0): string {
  const [int, dec] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  return dec ? `${grouped},${dec}` : grouped;
}

function signPrefix(value: number, sign: SignDisplay): string {
  if (sign === "never" || roundCents(value) === 0) return "";
  if (value < 0) return MINUS;
  return sign === "always" ? "+" : "";
}

export function formatMoney(
  value: number,
  { sign = "auto", cents = "auto" }: { sign?: SignDisplay; cents?: CentsDisplay } = {},
): string {
  const decimals = cents === "always" ? 2 : cents === "never" ? 0 : hasCents(value) ? 2 : 0;
  return `${signPrefix(value, sign)}${formatNumber(value, decimals)}${NBSP}€`;
}

/** Découpe un montant pour styliser séparément euros et centimes. */
export function splitMoney(value: number): { units: string; cents: string } {
  const [units, cents] = formatNumber(value, 2).split(",");
  return { units: `${signPrefix(value, "auto")}${units}`, cents: `,${cents}` };
}

/** 0.58 → « 58 % » (arrondi inférieur : on n'annonce jamais plus que la réalité). */
export function formatPercent(ratio: number): string {
  return `${Math.floor(ratio * 100 + 1e-9)}${GROUP}%`;
}

/** Part d'un total : jamais « 0 % » pour un montant non nul. */
export function formatShare(ratio: number): string {
  return ratio > 0 && ratio < 0.01 ? `<${GROUP}1${GROUP}%` : formatPercent(ratio);
}

/** Variation relative signée : 0.28 → « +28 % ». */
export function formatDelta(ratio: number): string {
  const rounded = Math.round(ratio * 100);
  const prefix = rounded > 0 ? "+" : rounded < 0 ? MINUS : "";
  return `${prefix}${Math.abs(rounded)}${GROUP}%`;
}

/** Montant compact pour les axes de graphiques : 2000 → « 2 000 ». */
export function formatAxis(value: number): string {
  return formatNumber(value, 0);
}

/** Lit une saisie utilisateur « 23,5 » / « 23.50 » → 23.5. */
export function parseAmountInput(input: string): number {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? roundCents(value) : 0;
}
