import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRecentRecovery, RECOVERY_REDIRECT } from "@/lib/auth-recovery";
import { safeNextPath } from "@/lib/safe-path";
import { dataSource } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour du lien reçu par e-mail (confirmation d'inscription ou mot de passe oublié) : ouvre la session
 * puis renvoie dans l'application. Lien invalide ou expiré → page de connexion.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("suite"));
  if (dataSource !== "supabase") return NextResponse.redirect(new URL("/", request.url));

  const supabase = await getSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    // Lien « mot de passe oublié » : on ouvre directement la saisie du nouveau mot de passe.
    if (!error) return NextResponse.redirect(new URL(isRecentRecovery(data.user?.recovery_sent_at) ? RECOVERY_REDIRECT : next, request.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(type === "recovery" ? RECOVERY_REDIRECT : next, request.url));
  }

  return NextResponse.redirect(new URL("/connexion?raison=lien-invalide", request.url));
}
