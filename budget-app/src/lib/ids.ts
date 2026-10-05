/**
 * Identifiant unique (UUID v4) généré côté appareil : l'opération garde le même
 * identifiant à l'écran et en base, sans aller-retour.
 * `crypto.randomUUID` n'existe qu'en contexte sécurisé (https / localhost) :
 * repli sur `getRandomValues`, disponible partout.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
