"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { AmountInput, EmojiPicker, FormField, TextInput, TonePicker } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { emojiChoices, toneChoices } from "@/config/categories";
import { parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { Tone } from "@/types/finance";

function AddCategoryForm() {
  const { addCategory } = useBudget();
  const { closeSheet, showToast } = useUI();
  const [label, setLabel] = useState("");
  const [group, setGroup] = useState<"variables" | "fixes">("variables");
  const [budgetText, setBudgetText] = useState("");
  const [emoji, setEmoji] = useState("🐾");
  const [tone, setTone] = useState<Tone>("blush");
  const canSubmit = label.trim().length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const category = addCategory({ label, emoji, group, tone, budget: parseAmountInput(budgetText) });
    closeSheet();
    showToast(`Catégorie « ${category.label} » créée`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
          <CategoryBadge emoji={emoji} tone={tone} />
          <div className="min-w-0">
            <p className="break-words font-semibold">{label.trim() || "Nouvelle catégorie"}</p>
            <p className="text-[13px] text-muted">{group === "fixes" ? "Charge fixe" : "Dépense du quotidien"}</p>
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
            ]}
            className="w-full"
          />
        </FormField>

        <FormField label="Budget mensuel" hint="facultatif" as="div">
          <AmountInput label="Budget mensuel en euros" value={budgetText} onChange={setBudgetText} size="md" />
        </FormField>

        <FormField label="Icône">
          <EmojiPicker value={emoji} options={emojiChoices} onChange={setEmoji} />
        </FormField>

        <FormField label="Couleur">
          <TonePicker value={tone} options={toneChoices} onChange={setTone} />
        </FormField>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
          {canSubmit ? "Créer la catégorie" : "Donne-lui un nom"}
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
