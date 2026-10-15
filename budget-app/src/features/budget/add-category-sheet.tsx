"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { AmountInput, EmojiPicker, FormField, TextInput, TonePicker } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { emojiChoices, toneChoices } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { CategoryInput } from "@/store/budget-state";
import type { Tone } from "@/types/finance";

const groupLabel: Record<CategoryInput["group"], string> = {
  variables: "Dépense du quotidien",
  fixes: "Charge fixe",
  revenus: "Revenu",
};

function AddCategoryForm() {
  const { addCategory, categories } = useBudget();
  const { closeSheet, showToast } = useUI();
  const { pending, error, run } = useAsyncAction();
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<CategoryInput["group"]>("variables");
  const [budgetText, setBudgetText] = useState("");
  const [emoji, setEmoji] = useState("🐾");
  const [tone, setTone] = useState<Tone>("blush");
  const duplicate = categories.some((c) => !c.archived && c.label.toLocaleLowerCase("fr") === label.trim().toLocaleLowerCase("fr"));
  const canSubmit = label.trim().length > 0 && !duplicate && !pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await run(async () => {
      // Un revenu n'a pas d'enveloppe budgétaire.
      await addCategory({ label, emoji, group, tone, budget: group === "revenus" ? 0 : parseAmountInput(budgetText) });
    });
    if (!ok) return;
    closeSheet();
    showToast(`Catégorie « ${label.trim()} » créée`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
          <CategoryBadge emoji={emoji} tone={tone} />
          <div className="min-w-0">
            <p className="break-words font-semibold">{label.trim() || "Nouvelle catégorie"}</p>
            <p className="text-[13px] text-muted">{groupLabel[group]}</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom</span>
          <TextInput data-autofocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex. Animaux, Cadeaux…" maxLength={24} />
        </label>

        <FormField label="Type">
          <SegmentedControl
            label="Type de catégorie"
            value={group}
            onChange={setGroup}
            options={[
              { value: "variables", label: "Quotidien" },
              { value: "fixes", label: "Charge fixe" },
              { value: "revenus", label: "Revenu" },
            ]}
            className="w-full"
          />
        </FormField>

        {group !== "revenus" && (
          <FormField label="Budget mensuel" hint="facultatif" as="div">
            <AmountInput label="Budget mensuel en euros" value={budgetText} onChange={setBudgetText} size="md" />
          </FormField>
        )}

        <FormField label="Icône">
          <EmojiPicker value={emoji} options={emojiChoices} onChange={setEmoji} />
        </FormField>

        <FormField label="Couleur">
          <TonePicker value={tone} options={toneChoices} onChange={setTone} />
        </FormField>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Création…" : duplicate ? "Ce nom existe déjà" : label.trim() ? "Créer la catégorie" : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

export function AddCategorySheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "category";

  return (
    <Sheet open={isSheetOpen && active} onClose={closeSheet} title="Nouvelle catégorie">
      {active && <AddCategoryForm key={sheetSession} />}
    </Sheet>
  );
}
