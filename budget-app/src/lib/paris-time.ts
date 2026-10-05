/**
 * Cocon raisonne en dates calendaires françaises : « aujourd'hui » est toujours
 * calculé en heure de Paris, quel que soit le fuseau de l'appareil ou du serveur.
 */
export const APP_TIME_ZONE = "Europe/Paris";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function todayInParis(now: Date = new Date()): string {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
