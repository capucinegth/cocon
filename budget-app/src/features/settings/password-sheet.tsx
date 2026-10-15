"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { PasswordField } from "@/features/auth/password-field";
import { PASSWORD_MIN_LENGTH, authErrorMessage, newPasswordProblem } from "@/lib/auth-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUI } from "@/store/ui-store";

function PasswordForm({ recovery }: { recovery: boolean }) {
  const { closeSheet, showToast } = useUI();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const problem = newPasswordProblem(password, confirmation);
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    try {
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError));
        setPending(false);
        return;
      }
      closeSheet();
      showToast("Mot de passe modifié");
    } catch (cause) {
      setError(authErrorMessage(cause as Error));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
      <div className="flex flex-col gap-5 px-6 pb-6 pt-2">
        <p className="text-[14px] text-muted">
          {recovery
            ? "Ta session est ouverte grâce au lien reçu par e-mail. Choisis maintenant ton nouveau mot de passe."
            : "Il remplace ton mot de passe actuel sur tous tes appareils."}
        </p>
        <PasswordField label="Nouveau mot de passe" value={password} onChange={setPassword} autoComplete="new-password" hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`} />
        <PasswordField label="Confirme le mot de passe" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending || undefined} className="w-full">
          {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </Button>
      </div>
    </form>
  );
}

/** Modifier son mot de passe (Paramètres), ou en choisir un nouveau après « Mot de passe oublié ». */
export function PasswordSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "password" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title={active?.recovery ? "Nouveau mot de passe" : "Modifier le mot de passe"}>
      {active && <PasswordForm key={sheetSession} recovery={active.recovery} />}
    </Sheet>
  );
}
