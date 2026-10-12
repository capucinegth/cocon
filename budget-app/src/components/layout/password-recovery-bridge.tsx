"use client";

import { useEffect } from "react";
import { RECOVERY_PARAM } from "@/lib/auth-recovery";
import { useSession } from "@/store/session-store";
import { useUI } from "@/store/ui-store";

/** Après un lien « mot de passe oublié » : ouvre directement la saisie du nouveau mot de passe. */
export function PasswordRecoveryBridge() {
  const { source } = useSession();
  const { openPassword } = useUI();

  useEffect(() => {
    if (source !== "supabase") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(RECOVERY_PARAM) !== "nouveau") return;
    url.searchParams.delete(RECOVERY_PARAM);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    openPassword(true);
  }, [source, openPassword]);

  return null;
}
