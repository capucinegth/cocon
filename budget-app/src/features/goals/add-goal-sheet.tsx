"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AmountInput, EmojiPicker, FormField, TextInput, TonePicker } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { emojiChoices, toneChoices } from "@/config/categories";
import { parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { Tone } from "@/types/finance";

function AddGoalForm() {
  const { addGoal, today } = useBudget();
  const { closeSheet, showToast } = useUI();
  const [label, setLabel] = useState("");
  const [targetText, setTargetText] = useState("");
  const [savedText, setSavedText] = useState("");
  const [monthlyText, setMonthlyText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [emoji, setEmoji] = useState("✈️");
  const [tone, setTone] = useState<Tone>("lilac");

  const target = parseAmountInput(targetText);
  const canSubmit = label.trim().length > 0 && target > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    addGoal({
      label: label.trim(),
      emoji,
      tone,
      target,
      saved: Math.min(parseAmountInput(savedText), target),
      monthlyContribution: parseAmountInput(monthlyText),
      deadline: deadline || undefined,
    });
    closeSheet();
    showToast(`Objectif « ${label.trim()} » créé`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom de l&apos;objectif</span>
          <TextInput data-autofocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Week-end à Lisbonne" maxLength={30} />
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

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Date cible <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput type="month" value={deadline} min={today.slice(0, 7)} onChange={(event) => setDeadline(event.target.value)} className="font-medium" />
        </label>

        <FormField label="Icône">
          <EmojiPicker value={emoji} options={emojiChoices} onChange={setEmoji} />
        </FormField>

        <FormField label="Couleur">
          <TonePicker value={tone} options={toneChoices} onChange={setTone} />
        </FormField>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
          {canSubmit ? "Créer l'objectif" : label.trim() ? "Indique un montant" : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

export function AddGoalSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "goal";

  return (
    <Sheet open={isSheetOpen && active} onClose={closeSheet} title="Nouvel objectif">
      {active && <AddGoalForm key={sheetSession} />}
    </Sheet>
  );
}
