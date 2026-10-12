"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/safe-path";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthCard, AuthNotice } from "./auth-card";
import { DemoAuthNotice } from "./demo-auth-notice";
import { PasswordField } from "./password-field";
import { dataSource } from "@/lib/supabase/env";

const reasons: Record<string, { text: string; tone: "info" | "success" }> = {
  session: { text: "Ta session a expiré. Reconnecte-toi pour retrouver tes données.", tone: "info" },
  deconnexion: { text: "Déconnexion réussie. À bientôt !", tone: "success" },
  confirmation: { text: "Adresse confirmée : tu peux te connecter.", tone: "success" },
  "lien-invalide": { text: "Ce lien n'est plus valide (il a peut-être déjà servi). Connecte-toi ou réessaie l'inscription.", tone: "info" },
};

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("suite"));
  const reason = reasons[params.get("raison") ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dataSource === "demo") return <DemoAuthNotice />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim() || !password) return setError("Indique ton e-mail et ton mot de passe.");
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        setError(authErrorMessage(signInError));
        setPending(false);
        return;
      }
      // Rechargement complet : le serveur voit immédiatement la nouvelle session.
      window.location.assign(next);
    } catch (cause) {
      setError(authErrorMessage(cause as Error));
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Bon retour 👋"
      subtitle="Connecte-toi pour retrouver ton budget."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={next === "/" ? "/inscription" : `/inscription?suite=${encodeURIComponent(next)}`} className="font-semibold text-blush-700 underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {reason && <AuthNotice tone={reason.tone}>{reason.text}</AuthNotice>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-2.5 block text-sm font-semibold text-muted">
            Adresse e-mail
          </label>
          <input
            id="login-email"
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
        <div>
          <PasswordField label="Mot de passe" value={password} onChange={setPassword} autoComplete="current-password" />
          <Link href="/mot-de-passe-oublie" className="mt-2.5 inline-block text-[14px] font-semibold text-blush-700 underline-offset-4 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full">
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </AuthCard>
  );
}
