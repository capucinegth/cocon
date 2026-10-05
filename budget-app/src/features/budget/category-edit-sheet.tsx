"use client";

import { Archive } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AmountInput, EmojiPicker, FormField, TextInput, TonePicker, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { emojiChoices, findCategory, toneChoices } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { planFor } from "@/lib/budget";
import { formatMonth } from "@/lib/dates";
import { parseAmountInput, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { Tone } from "@/types/finance";

function CategoryEditForm({ categoryId, month }: { categoryId: string; month: string }) {
  const data = useBudget();
  const { closeSheet, showToast } = useUI();
  const category = findCategory(data.categories, categoryId);
  const planned = planFor(data, month)?.planned[categoryId] ?? 0;
  const [budgetText, setBudgetText] = useState(amountToInput(planned));
  const [label, setLabel] = useState(category.label);
  const [emoji, setEmoji] = useState(category.emoji);
  const [tone, setTone] = useState<Tone>(category.tone);
  const save = useAsyncAction();
  const archive = useAsyncAction();

  const budget = roundCents(parseAmountInput(budgetText));
  const changedLook = label.trim() !== category.label || emoji !== category.emoji || tone !== category.tone;
  const changedBudget = budget !== planned;
  const canSubmit = label.trim().length > 0 && (changedLook || changedBudget) && !save.pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await save.run(async () => {
      if (changedLook) await data.updateCategory(categoryId, { label: label.trim(), emoji, tone });
      if (changedBudget) await data.setCategoryBudget(month, categoryId, budget);
    });
    if (!ok) return;
    closeSheet();
    showToast(`« ${label.trim()} » mise à jour`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
          <CategoryBadge emoji={emoji} tone={tone} />
          <div className="min-w-0">
            <p className="break-words font-semibold">{label.trim() || category.label}</p>
            <p className="text-[13px] text-muted">{category.group === "fixes" ? "Charge fixe" : "Dépense du quotidien"}</p>
          </div>
        </div>

        <FormField label={`Budget de ${formatMonth(month).toLowerCase()}`} as="div">
          <AmountInput label="Budget du mois en euros" value={budgetText} onChange={setBudgetText} size="md" autoFocus />
          <p className="mt-2 text-[13px] text-muted">Les mois suivants reprendront ce montant tant que tu ne le changes pas.</p>
        </FormField>

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom</span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} />
        </label>

        <FormField label="Icône">
          <EmojiPicker value={emoji} options={emojiChoices.includes(category.emoji) ? emojiChoices : [category.emoji, ...emojiChoices]} onChange={setEmoji} />
        </FormField>

        <FormField label="Couleur">
          <TonePicker value={tone} options={toneChoices} onChange={setTone} />
        </FormField>

        <div>
          <ConfirmButton
            question={`Archiver « ${category.label} » ? Elle disparaîtra de tes listes ; ses opérations passées restent dans l'historique.`}
            confirmLabel="Archiver"
            pending={archive.pending}
            onConfirm={async () => {
              const ok = await archive.run(() => data.archiveCategory(categoryId));
              if (!ok) return;
              closeSheet();
              showToast(`« ${category.label} » archivée`);
            }}
          >
            <Archive size={16} aria-hidden />
            Archiver la catégorie
          </ConfirmButton>
          <FormError message={archive.error} className="mt-3" />
        </div>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={save.error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={save.pending || undefined}>
          {save.pending ? "Enregistrement…" : label.trim() ? "Enregistrer" : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

/** Modifier une catégorie de dépense : budget du mois, nom, icône, couleur ; ou l'archiver. */
export function CategoryEditSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "categoryEdit" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Modifier la catégorie">
      {active && <CategoryEditForm key={sheetSession} categoryId={active.categoryId} month={active.month} />}
    </Sheet>
  );
}
