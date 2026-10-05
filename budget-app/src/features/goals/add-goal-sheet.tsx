"use client";

import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AmountInput, EmojiPicker, FormField, TextInput, TonePicker, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { emojiChoices, toneChoices } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { SavingsGoal, Tone } from "@/types/finance";

function GoalForm({ goal }: { goal?: SavingsGoal }) {
  const { addGoal, updateGoal, removeGoal, today } = useBudget();
  const { closeSheet, showToast } = useUI();
  const [label, setLabel] = useState(goal?.label ?? "");
  const [targetText, setTargetText] = useState(amountToInput(goal?.target));
  const [savedText, setSavedText] = useState(amountToInput(goal?.initialAmount));
  const [monthlyText, setMonthlyText] = useState(amountToInput(goal?.monthlyContribution));
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "✈️");
  const [tone, setTone] = useState<Tone>(goal?.tone ?? "lilac");
  const save = useAsyncAction();
  const remove = useAsyncAction();

  const target = parseAmountInput(targetText);
  const canSubmit = label.trim().length > 0 && target > 0 && !save.pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const input = {
      label: label.trim(),
      emoji,
      tone,
      target,
      initialAmount: parseAmountInput(savedText),
      monthlyContribution: parseAmountInput(monthlyText),
      deadline: deadline || undefined,
    };
    const ok = await save.run(async () => {
      if (goal) await updateGoal(goal.id, input);
      else await addGoal(input);
    });
    if (!ok) return;
    closeSheet();
    showToast(goal ? `Objectif « ${input.label} » mis à jour` : `Objectif « ${input.label} » créé`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom de l&apos;objectif</span>
          <TextInput data-autofocus={!goal || undefined} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Week-end à Lisbonne" maxLength={40} />
        </label>

        <FormField label="Montant à atteindre" as="div">
          <AmountInput label="Montant à atteindre en euros" value={targetText} onChange={setTargetText} size="md" />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-2.5 block text-sm font-semibold text-muted">Déjà épargné</span>
            <TextInput inputMode="decimal" value={savedText} onChange={(event) => setSavedText(event.target.value)} placeholder="0 €" />
          </label>
          <label className="block min-w-0">
            <span className="mb-2.5 block text-sm font-semibold text-muted">Par mois</span>
            <TextInput inputMode="decimal" value={monthlyText} onChange={(event) => setMonthlyText(event.target.value)} placeholder="0 €" />
          </label>
        </div>
        {goal && (
          <p className="-mt-3 text-[13px] text-muted">« Déjà épargné » : ce que tu avais avant de suivre cet objectif dans Cocon. Tes versements s&apos;y ajoutent.</p>
        )}

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Date cible <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput type="month" value={deadline} min={today.slice(0, 7)} onChange={(event) => setDeadline(event.target.value)} className="font-medium" />
        </label>

        <FormField label="Icône">
          <EmojiPicker value={emoji} options={emojiChoices.includes(emoji) ? emojiChoices : [emoji, ...emojiChoices]} onChange={setEmoji} />
        </FormField>

        <FormField label="Couleur">
          <TonePicker value={tone} options={toneChoices} onChange={setTone} />
        </FormField>

        {goal && (
          <div>
            <ConfirmButton
              question={`Supprimer « ${goal.label} » ? Tes versements restent dans tes opérations, comme épargne libre.`}
              confirmLabel="Supprimer"
              pending={remove.pending}
              onConfirm={async () => {
                const ok = await remove.run(() => removeGoal(goal.id));
                if (!ok) return;
                closeSheet();
                showToast(`Objectif « ${goal.label} » supprimé`);
              }}
            >
              <Trash2 size={16} aria-hidden />
              Supprimer l&apos;objectif
            </ConfirmButton>
            <FormError message={remove.error} className="mt-3" />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={save.error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={save.pending || undefined}>
          {save.pending
            ? "Enregistrement…"
            : canSubmit
              ? goal
                ? "Enregistrer"
                : "Créer l'objectif"
              : label.trim()
                ? "Indique un montant"
                : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

/** Création ou modification d'un objectif d'épargne. */
export function AddGoalSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const { goals } = useBudget();
  const active = sheet?.type === "goal" ? sheet : null;
  const goal = active?.goalId ? goals.find((g) => g.id === active.goalId) : undefined;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title={active?.goalId ? "Modifier l'objectif" : "Nouvel objectif"}>
      {active && <GoalForm key={sheetSession} goal={goal} />}
    </Sheet>
  );
}
