"use client";

import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AmountInput, FormField, TextInput, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { useAsyncAction } from "@/hooks/use-async-action";
import { formatLongDate } from "@/lib/dates";
import { parseAmountInput, roundCents } from "@/lib/format";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

const frequencyLabel = { weekly: "Chaque semaine", monthly: "Chaque mois" } as const;
const kindLabel = { expense: "Dépense", income: "Revenu", saving: "Épargne" } as const;

function RecurringForm({ ruleId }: { ruleId: string }) {
  const { recurring, updateRecurring, removeRecurring } = useBudget();
  const categoryOf = useCategoryLookup();
  const { closeSheet, showToast } = useUI();
  const rule = recurring.find((r) => r.id === ruleId);
  const [label, setLabel] = useState(rule?.label ?? "");
  const [amountText, setAmountText] = useState(amountToInput(rule?.amount));
  const [isActive, setActive] = useState(rule?.isActive ?? true);
  const save = useAsyncAction();
  const remove = useAsyncAction();

  if (!rule) {
    return <p className="px-6 pb-8 pt-2 text-[15px] text-muted">Cette opération récurrente n&apos;existe plus.</p>;
  }

  const category = categoryOf(rule.categoryId);
  const amount = roundCents(parseAmountInput(amountText));
  const changed = label.trim() !== rule.label || amount !== rule.amount || isActive !== rule.isActive;
  const canSubmit = label.trim().length > 0 && amount > 0 && changed && !save.pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await save.run(() => updateRecurring(ruleId, { label: label.trim(), amount, isActive }));
    if (!ok) return;
    closeSheet();
    showToast(isActive ? "Récurrence mise à jour" : "Récurrence mise en pause");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
          <CategoryBadge emoji={category.emoji} tone={category.tone} />
          <div className="min-w-0">
            <p className="break-words font-semibold">
              {kindLabel[rule.kind]} · {category.label}
            </p>
            <p className="text-[13px] text-muted">
              {frequencyLabel[rule.frequency]} · prochaine le {formatLongDate(rule.nextOccurrence).toLowerCase()}
            </p>
          </div>
        </div>

        <FormField label="Montant" as="div">
          <AmountInput label="Montant en euros" value={amountText} onChange={setAmountText} size="md" prefix={rule.kind === "income" ? "+" : "−"} />
          <p className="mt-2 text-[13px] text-muted">S&apos;applique aux prochaines échéances ; les opérations passées ne changent pas.</p>
        </FormField>

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Description</span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
        </label>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
          <span>
            <span className="block text-[15px] font-semibold">Active</span>
            <span className="block text-[13px] text-muted">En pause, plus rien n&apos;est ajouté automatiquement.</span>
          </span>
          <Toggle checked={isActive} onChange={setActive} label="Récurrence active" />
        </div>

        <div>
          <ConfirmButton
            question="Supprimer cette récurrence ? Les opérations déjà passées sont conservées."
            confirmLabel="Supprimer"
            pending={remove.pending}
            onConfirm={async () => {
              const ok = await remove.run(() => removeRecurring(ruleId));
              if (!ok) return;
              closeSheet();
              showToast("Récurrence supprimée");
            }}
          >
            <Trash2 size={16} aria-hidden />
            Supprimer la récurrence
          </ConfirmButton>
          <FormError message={remove.error} className="mt-3" />
        </div>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={save.error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={save.pending || undefined}>
          {save.pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

/** Loyer, salaire, abonnement… : montant, pause ou suppression d'une règle récurrente. */
export function RecurringSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "recurring" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Opération récurrente">
      {active && <RecurringForm key={sheetSession} ruleId={active.ruleId} />}
    </Sheet>
  );
}
