"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { AmountInput, FormField, TextInput } from "@/components/ui/form";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { getAccount, quickAddAccountIds } from "@/config/accounts";
import { isExpenseCategory } from "@/config/categories";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import { formatMoney, formatPercent, parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI, type AddPreset } from "@/store/ui-store";
import type { AccountId, CategoryId, Recurrence, TransactionKind } from "@/types/finance";

type DateChoice = "today" | "yesterday" | "other";

const kindCopy: Record<TransactionKind, { label: string; placeholder: string; done: string }> = {
  expense: { label: "Dépense", placeholder: "Ex. Carrefour, dîner chez Léa…", done: "Dépense ajoutée" },
  income: { label: "Revenu", placeholder: "Ex. Salaire, remboursement…", done: "Revenu ajouté" },
  saving: { label: "Épargne", placeholder: "Ex. Virement du mois", done: "Épargne ajoutée" },
};

const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Une fois" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
];

function AddTransactionForm({ preset }: { preset: AddPreset }) {
  const { today, categories, goals, addTransaction, removeTransaction } = useBudget();
  const { closeSheet, showToast, highlight } = useUI();

  const [kind, setKind] = useState<TransactionKind>(preset.kind ?? "expense");
  const [amountText, setAmountText] = useState("");
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [goalId, setGoalId] = useState<string | null>(preset.goalId ?? null);
  const [accountId, setAccountId] = useState<AccountId>("courant");
  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [otherDate, setOtherDate] = useState(addDays(today, -2));
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const amount = parseAmountInput(amountText);
  const date = dateChoice === "today" ? today : dateChoice === "yesterday" ? addDays(today, -1) : otherDate;
  const categoryOptions = categories.filter((c) => (kind === "income" ? c.group === "revenus" : isExpenseCategory(c)));
  const needsCategory = kind !== "saving";
  const canSubmit = amount > 0 && (!needsCategory || categoryId !== null);
  const signed = kind === "income" ? amount : -amount;
  const copy = kindCopy[kind];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const transaction = addTransaction({
      amount,
      kind,
      categoryId: kind === "saving" ? "epargne" : (categoryId ?? "autres"),
      goalId: kind === "saving" ? (goalId ?? undefined) : undefined,
      accountId,
      date,
      label,
      recurrence,
    });
    closeSheet();
    highlight(transaction.id);
    showToast(`${copy.done} · ${formatMoney(signed, { sign: "always" })}`, {
      label: "Annuler",
      onAction: () => removeTransaction(transaction),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <SegmentedControl
          label="Type d'opération"
          value={kind}
          onChange={(next) => {
            setKind(next);
            setCategoryId(null);
          }}
          options={(Object.keys(kindCopy) as TransactionKind[]).map((value) => ({ value, label: kindCopy[value].label }))}
          className="w-full"
        />

        <AmountInput label="Montant en euros" value={amountText} onChange={setAmountText} prefix={kind === "income" ? "+" : "−"} autoFocus />

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Description <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} placeholder={copy.placeholder} maxLength={40} />
        </label>

        {kind === "saving" ? (
          <FormField label="Vers quel objectif ?">
            <div className="flex flex-col gap-2">
              {goals.map((goal) => {
                const selected = goal.id === goalId;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setGoalId(selected ? null : goal.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl p-3 text-left transition-all duration-200 active:scale-[0.99]",
                      selected ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
                    )}
                  >
                    <CategoryBadge emoji={goal.emoji} tone={goal.tone} size="sm" />
                    <span className="min-w-0 flex-1 break-words text-[15px] font-semibold">{goal.label}</span>
                    <span className={cn("text-[13px] font-medium", selected ? "text-white/80" : "text-muted")}>
                      {formatPercent(goal.saved / goal.target)}
                    </span>
                  </button>
                );
              })}
              <p className="text-[13px] text-muted">Sans objectif choisi, l&apos;épargne reste « libre ».</p>
            </div>
          </FormField>
        ) : (
          <FormField label="Catégorie">
            <div className="grid grid-cols-4 gap-2">
              {categoryOptions.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-all duration-200 active:scale-[0.96]",
                      selected ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
                    )}
                  >
                    <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
                    <span className="line-clamp-2 w-full break-words text-center text-[12px] font-semibold leading-tight">{category.shortLabel ?? category.label}</span>
                  </button>
                );
              })}
            </div>
          </FormField>
        )}

        <FormField label="Date">
          <div className="flex flex-wrap gap-2">
            <ChoiceChip selected={dateChoice === "today"} onClick={() => setDateChoice("today")}>
              Aujourd&apos;hui
            </ChoiceChip>
            <ChoiceChip selected={dateChoice === "yesterday"} onClick={() => setDateChoice("yesterday")}>
              Hier
            </ChoiceChip>
            <ChoiceChip selected={dateChoice === "other"} onClick={() => setDateChoice("other")}>
              Autre date
            </ChoiceChip>
          </div>
          {dateChoice === "other" && (
            <TextInput
              type="date"
              aria-label="Choisir une date"
              value={otherDate}
              max={today}
              onChange={(event) => event.target.value && setOtherDate(event.target.value)}
              className="mt-3 animate-fade font-medium"
            />
          )}
        </FormField>

        <FormField label="Récurrence">
          <div className="flex flex-wrap gap-2">
            {recurrenceOptions.map((option) => (
              <ChoiceChip key={option.value} selected={recurrence === option.value} onClick={() => setRecurrence(option.value)}>
                {option.label}
              </ChoiceChip>
            ))}
          </div>
        </FormField>

        <FormField label="Compte">
          <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
            {quickAddAccountIds.map((id) => {
              const account = getAccount(id);
              return (
                <ChoiceChip key={id} selected={id === accountId} onClick={() => setAccountId(id)}>
                  <span aria-hidden>{account.emoji}</span>
                  {account.label}
                </ChoiceChip>
              );
            })}
          </div>
        </FormField>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
          {canSubmit ? `Ajouter ${formatMoney(signed, { sign: "always" })}` : amount > 0 ? "Choisis une catégorie" : "Saisis un montant"}
        </Button>
      </div>
    </form>
  );
}

/** Feuille d'ajout rapide, ouverte depuis n'importe quel écran. */
export function AddTransactionSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "add" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Nouvelle opération">
      {active && <AddTransactionForm key={sheetSession} preset={active.preset} />}
    </Sheet>
  );
}
