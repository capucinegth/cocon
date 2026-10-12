/**
 * Retour d'un lien « mot de passe oublié » : /auth/callback ouvre la session puis renvoie vers
 * l'accueil avec ce paramètre, qui ouvre la saisie du nouveau mot de passe.
 */
export const RECOVERY_PARAM = "motdepasse";
export const RECOVERY_REDIRECT = `/?${RECOVERY_PARAM}=nouveau`;

/** Durée de validité d'un lien de réinitialisation chez Supabase (1 h par défaut). */
const RECOVERY_WINDOW_MS = 60 * 60 * 1000;

/** La session vient-elle d'un lien de réinitialisation demandé il y a moins d'une heure ? */
export function isRecentRecovery(recoverySentAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!recoverySentAt) return false;
  const sent = Date.parse(recoverySentAt);
  return Number.isFinite(sent) && now.getTime() - sent >= 0 && now.getTime() - sent <= RECOVERY_WINDOW_MS;
}
