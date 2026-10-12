"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dataSource } from "@/lib/supabase/env";
import { AuthCard } from "./auth-card";
import { DemoAuthNotice } from "./demo-auth-notice";

const backLink = (
  <Link href="/connexion" className="font-semibold text-blush-700 underline-offset-4 hover:underline">
    Retour à la connexion
  </Link>
);

/**
 * Mot de passe oublié : Supabase envoie un lien par e-mail. Ce lien ouvre une session (via /auth/callback)
 * puis la saisie du nouveau mot de passe. Le message est le même que l'adresse ait un compte ou non.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (dataSource === "demo") return <DemoAuthNotice />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Indique une adresse e-mail valide.");
    setPending(true);
    setError(null);
    try {
      const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/auth/callback", window.location.origin).toString(),
      });
      if (resetError) {
        setError(authErrorMessage(resetError));
        setPending(false);
        return;
      }
      setSent(true);
    } catch (cause) {
      setError(authErrorMessage(cause as Error));
    }
    setPending(false);
  }

  if (sent) {
    return (
      <AuthCard title="Vérifie ta boîte mail" footer={backLink}>
        <div className="flex flex-col items-center text-center" role="status">
          <span className="grid size-16 place-items-center rounded-full bg-sage-50">
            <MailCheck size={28} className="text-sage-700" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-ink-soft">
            Si un compte existe pour <span className="break-all font-semibold text-ink">{email.trim()}</span>, un lien pour choisir un nouveau mot de passe
            vient d&apos;être envoyé (pense aux indésirables).
          </p>
          <p className="mt-3 text-[13px] text-muted">Ouvre-le dans ce navigateur : tu pourras saisir ton nouveau mot de passe.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Mot de passe oublié" subtitle="Indique ton adresse : tu recevras un lien pour en choisir un nouveau." footer={backLink}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="forgot-email" className="mb-2.5 block text-sm font-semibold text-muted">
            Adresse e-mail
          </label>
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputStyles}
          />
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full">
          {pending ? "Envoi…" : "Recevoir le lien"}
        </Button>
      </form>
    </AuthCard>
  );
}
