/**
 * Messages d'erreur d'authentification, en français et sans détail technique.
 * Ne révèle jamais si une adresse possède déjà un compte (sauf quand Supabase le dit explicitement).
 */
interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
}

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return "Une erreur est survenue. Réessaie dans un instant.";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (error.name === "AuthRetryableFetchError" || error.status === 0 || /fetch|network|load failed/.test(message)) {
    return "Connexion impossible. Vérifie ta connexion Internet puis réessaie.";
  }
  switch (code) {
    case "invalid_credentials":
      return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirme d'abord ton adresse : clique sur le lien reçu par e-mail (pense aux indésirables).";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse. Connecte-toi plutôt.";
    case "weak_password":
      return "Mot de passe trop faible : au moins 8 caractères, en mélangeant lettres et chiffres.";
    case "email_address_invalid":
    case "validation_failed":
      return "Cette adresse e-mail n'est pas valide.";
    case "email_address_not_authorized":
      return "Cette adresse e-mail n'est pas autorisée pour le moment.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    case "session_expired":
    case "session_not_found":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "Ta session a expiré. Reconnecte-toi.";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return "Ce lien n'est plus valide. Demande-en un nouveau.";
  }
  if (error.status === 429) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
  if (/invalid login credentials/.test(message)) return "E-mail ou mot de passe incorrect.";
  if (/password/.test(message) && /(short|weak|at least|characters)/.test(message)) {
    return "Mot de passe trop faible : au moins 8 caractères, en mélangeant lettres et chiffres.";
  }
  return "Une erreur est survenue. Réessaie dans un instant.";
}

/** Règles côté formulaire (Supabase vérifie aussi de son côté). */
export const PASSWORD_MIN_LENGTH = 8;

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Indique une adresse e-mail valide.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  return null;
}
