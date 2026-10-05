/**
 * Dates manipulées en chaînes ISO (AAAA-MM-JJ) et calculées en UTC :
 * aucun décalage de fuseau, rendu identique serveur / navigateur.
 */

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const DAY_MS = 86_400_000;

function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day = 1] = iso.split("-").map(Number);
  return { year, month, day };
}

function toUTC(iso: string): number {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month - 1, day);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function toISODate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(toUTC(iso) + days * DAY_MS);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(iso: string): number {
  const { year, month } = parts(iso);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** « 2026-09 » + 2 → « 2026-11 » (accepte aussi une date complète). */
export function addMonths(isoOrMonth: string, count: number): string {
  const { year, month } = parts(isoOrMonth);
  const index = year * 12 + (month - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Dernier jour du mois d'une date : « 2026-02-10 » → « 2026-02-28 ». */
export function endOfMonth(iso: string): string {
  return `${monthKey(iso)}-${String(daysInMonth(iso)).padStart(2, "0")}`;
}

export function dayOfMonth(iso: string): number {
  return parts(iso).day;
}

/** « 2026-09 » → « Septembre 2026 » */
export function formatMonth(isoOrMonth: string): string {
  const { year, month } = parts(isoOrMonth);
  return `${capitalize(MONTHS[month - 1])} ${year}`;
}

/** « 2026-09 » → « Septembre » */
export function formatMonthName(isoOrMonth: string): string {
  return capitalize(MONTHS[parts(isoOrMonth).month - 1]);
}

/** « 2026-09 » → « Sept. » (axes de graphiques) */
export function formatMonthShort(isoOrMonth: string): string {
  return capitalize(MONTHS_SHORT[parts(isoOrMonth).month - 1]);
}

/** « 2027-07 » → « juillet 2027 » */
export function formatMonthLower(isoOrMonth: string): string {
  const { year, month } = parts(isoOrMonth);
  return `${MONTHS[month - 1]} ${year}`;
}

/** « 2026-09-18 » → « 18 sept. » */
export function formatShortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** « 2026-09-06 » → « Dimanche 6 septembre » */
export function formatLongDate(iso: string): string {
  const { month, day } = parts(iso);
  const weekday = WEEKDAYS[new Date(toUTC(iso)).getUTCDay()];
  return `${capitalize(weekday)} ${day === 1 ? "1er" : day} ${MONTHS[month - 1]}`;
}

/** Titre de groupe dans la liste des transactions. */
export function formatDayHeading(iso: string, today: string): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff === -1) return "Demain";
  if (diff > 1 && diff < 7) return capitalize(WEEKDAYS[new Date(toUTC(iso)).getUTCDay()]);
  return formatLongDate(iso);
}

/** « Aujourd'hui », « Demain », « Dans 5 jours » */
export function formatRelativeFuture(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return `Dans ${diff} jours`;
}

export function getMonthDay(iso: string): { day: string; month: string } {
  const { month, day } = parts(iso);
  return { day: String(day), month: MONTHS_SHORT[month - 1] };
}
