"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { PASSWORD_MIN_LENGTH, authErrorMessage, validateCredentials } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/safe-path";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dataSource } from "@/lib/supabase/env";
import { AuthCard } from "./auth-card";
import { DemoAuthNotice } from "./demo-auth-notice";
import { PasswordField } from "./password-field";

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("suite"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  if (dataSource === "demo") return <DemoAuthNotice />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const invalid = validateCredentials(email, password);
    if (invalid) return setError(invalid);
    setPending(true);
    setError(null);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      if (next !== "/") callback.searchParams.set("suite", next);
      const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() }, emailRedirectTo: callback.toString() },
      });
      if (signUpError) {
        setError(authErrorMessage(signUpError));
        setPending(false);
        return;
      }
      if (data.session) {
        // Confirmation par e-mail désactivée : le compte est prêt.
        window.location.assign(next);
        return;
      }
      // Confirmation par e-mail requise (ou adresse déjà inscrite : même message, rien n'est révélé).
      setCheckInbox(true);
      setPending(false);
    } catch (cause) {
      setError(authErrorMessage(cause as Error));
      setPending(false);
    }
  }

  if (checkInbox) {
    return (
      <AuthCard title="Vérifie ta boîte mail" footer={<Link href="/connexion" className="font-semibold text-blush-700 underline-offset-4 hover:underline">Retour à la connexion</Link>}>
        <div className="flex flex-col items-center text-center" role="status">
          <span className="grid size-16 place-items-center rounded-full bg-sage-50">
            <MailCheck size={28} className="text-sage-700" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] text-ink-soft">
            Un lien de confirmation a été envoyé à <span className="break-all font-semibold text-ink">{email.trim()}</span>. Clique dessus pour activer ton
            compte (pense à regarder dans les indésirables).
          </p>
          <p className="mt-3 text-[13px] text-muted">Tu as déjà un compte avec cette adresse ? Connecte-toi directement.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Créer ton Cocon"
      subtitle="Ton budget, enregistré et retrouvé sur tous tes appareils."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href={next === "/" ? "/connexion" : `/connexion?suite=${encodeURIComponent(next)}`} className="font-semibold text-blush-700 underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="signup-name" className="mb-2.5 block text-sm font-semibold text-muted">
            Prénom <span className="font-medium">(facultatif)</span>
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="given-name"
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputStyles}
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="mb-2.5 block text-sm font-semibold text-muted">
            Adresse e-mail
          </label>
          <input
            id="signup-email"
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
        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full">
          {pending ? "Création du compte…" : "Créer mon compte"}
        </Button>
        <p className="text-center text-[13px] text-muted">Aucune donnée bancaire n&apos;est demandée. Tu saisis toi-même tes opérations.</p>
      </form>
    </AuthCard>
  );
}
