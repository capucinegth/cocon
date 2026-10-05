"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

function ProfileForm() {
  const { profile, updateProfile } = useBudget();
  const { closeSheet, showToast } = useUI();
  const [name, setName] = useState(profile?.displayName ?? "");
  const { pending, error, run } = useAsyncAction();
  const changed = name.trim() !== (profile?.displayName ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!changed || pending) return;
    const ok = await run(() => updateProfile({ displayName: name.trim() }));
    if (!ok) return;
    closeSheet();
    showToast("Profil mis à jour");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Ton prénom (ou pseudo)</span>
          <TextInput data-autofocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="given-name" placeholder="Ex. Camille" />
        </label>
        <p className="text-[13px] text-muted">Utilisé pour te saluer sur l&apos;accueil. Laisse vide si tu préfères.</p>
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!changed || pending} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function ProfileSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "profile";

  return (
    <Sheet open={isSheetOpen && active} onClose={closeSheet} title="Ton profil">
      {active && <ProfileForm key={sheetSession} />}
    </Sheet>
  );
}
