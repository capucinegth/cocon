"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { AmountInput, FormField, TextInput, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { isExpenseCategory } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import { formatMoney, formatPercent, parseAmountInput } from "@/lib/format";
import { errorMessage } from "@/services/repository";
import { useBudget } from "@/store/budget-store";
import { accountChoices, destinationChoices, preferredAccountId, preferredDestinationId } from "@/lib/accounts";
import { defaultAccountId, savingCategoryId } from "@/store/budget-state";
import { useUI, type AddPreset } from "@/store/ui-store";
import { ReceiptScanButton } from "./receipt-scan-button";
import type { AccountId, CategoryId, Recurrence, Transaction, TransactionKind } from "@/types/finance";

type DateChoice = "today" | "yesterday" | "other";

const kindCopy: Record<TransactionKind, { label: string; placeholder: string; done: string }> = {
  expense: { label: "Dépense", placeholder: "Ex. Carrefour, dîner chez Léa…", done: "Dépense ajoutée" },
  income: { label: "Revenu", placeholder: "Ex. Salaire, remboursement…", done: "Revenu ajouté" },
  saving: { label: "Épargne", placeholder: "Ex. Virement du mois", done: "Épargne ajoutée" },
};

/** Jusqu'où une opération peut être prévue à l'avance. */
const MAX_DAYS_AHEAD = 366;

function initialDateChoice(date: string | undefined, today: string): DateChoice {
  if (!date || date === today) return "today";
  return date === addDays(today, -1) ? "yesterday" : "other";
}

const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Une fois" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
];

function AddTransactionForm({ preset }: { preset: AddPreset }) {
  const { today, categories, goals, accounts, addTransaction, updateTransaction, removeTransaction } = useBudget();
  const { closeSheet, showToast, showError, highlight } = useUI();
  const editing: Transaction | undefined = preset.transaction;

  const [kind, setKind] = useState<TransactionKind>(editing?.kind ?? preset.kind ?? "expense");
  const [amountText, setAmountText] = useState(amountToInput(editing?.amount));
  const [label, setLabel] = useState(editing?.label ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(editing && editing.kind !== "saving" ? editing.categoryId : null);
  const [goalId, setGoalId] = useState<string | null>(editing?.goalId ?? preset.goalId ?? null);
  const [accountId, setAccountId] = useState<AccountId>(editing?.accountId ?? defaultAccountId({ accounts }));
  // Épargne = transfert vers un compte d'épargne. Une ancienne épargne sans destination doit en recevoir une.
  const [transferAccountId, setTransferAccountId] = useState<AccountId | undefined>(
    editing ? editing.transferAccountId : preferredDestinationId(accounts),
  );
  const [dateChoice, setDateChoice] = useState<DateChoice>(initialDateChoice(editing?.date, today));
  const [otherDate, setOtherDate] = useState(editing?.date ?? addDays(today, -2));
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const { pending, error, run } = useAsyncAction();

  const amount = parseAmountInput(amountText);
  const date = dateChoice === "today" ? today : dateChoice === "yesterday" ? addDays(today, -1) : otherDate;
  const categoryOptions = categories.filter(
    (c) => (!c.archived || c.id === editing?.categoryId) && (kind === "income" ? c.group === "revenus" : isExpenseCategory(c)),
  );
  // Comptes actifs hors épargne (source d'une épargne) ; le compte d'origine reste proposé en modification.
  const accountOptions = accountChoices(accounts, kind, editing?.accountId);
  const destinationOptions = destinationChoices(accounts, editing?.transferAccountId);
  const needsCategory = kind !== "saving";
  const needsDestination = kind === "saving";
  const canSubmit = amount > 0 && (!needsCategory || categoryId !== null) && (!needsDestination || transferAccountId !== undefined) && !pending;
  const signed = kind === "income" ? amount : -amount;
  const copy = kindCopy[kind];
  const isFuture = date > today;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const input = {
      amount,
      kind,
      categoryId: kind === "saving" ? savingCategoryId({ categories }) : (categoryId as CategoryId),
      goalId: kind === "saving" ? (goalId ?? undefined) : undefined,
      accountId,
      transferAccountId: kind === "saving" ? transferAccountId : undefined,
      date,
      label,
      // Vide : la note est effacée.
      note,
    };
    let saved: Transaction | undefined;
    const ok = await run(async () => {
      saved = editing
        ? await updateTransaction(editing, input)
        : await addTransaction({ ...input, recurrence });
    });
    if (!ok || !saved) return;
    const transaction = saved;
    closeSheet();
    highlight(transaction.id);
    if (editing) {
      showToast("Opération modifiée");
      return;
    }
    showToast(`${isFuture ? "Opération prévue" : copy.done} · ${formatMoney(signed, { sign: "always" })}`, {
      label: "Annuler",
      onAction: () => {
        removeTransaction(transaction, { withRecurrence: true }).catch((cause) => showError(errorMessage(cause)));
      },
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
            // L'épargne se verse depuis un compte hors épargne.
            if (!accountChoices(accounts, next, editing?.accountId).some((a) => a.id === accountId)) setAccountId(preferredAccountId(accounts, next));
          }}
          options={(Object.keys(kindCopy) as TransactionKind[]).map((value) => ({ value, label: kindCopy[value].label }))}
          className="w-full"
        />

        <AmountInput label="Montant en euros" value={amountText} onChange={setAmountText} prefix={kind === "income" ? "+" : "−"} autoFocus={!editing} />
        {kind === "expense" && !editing && (
          <ReceiptScanButton
            today={today}
            onRead={(reading) => {
              if (reading.amount !== undefined) setAmountText(amountToInput(reading.amount));
              if (reading.merchant && !label.trim()) setLabel(reading.merchant);
              if (reading.date && reading.date !== today) {
                if (reading.date === addDays(today, -1)) setDateChoice("yesterday");
                else {
                  setDateChoice("other");
                  setOtherDate(reading.date);
                }
              }
            }}
          />
        )}

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Description <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} placeholder={copy.placeholder} maxLength={40} />
        </label>
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Note <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Un détail à retenir" maxLength={280} />
        </label>

        {kind === "saving" ? (
          <FormField label="Vers quel objectif ?">
            <div className="flex flex-col gap-2">
              {goals.length === 0 && <p className="text-[13px] text-muted">Tu n&apos;as pas encore d&apos;objectif : l&apos;épargne restera « libre ».</p>}
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
                      {formatPercent(goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 0)}
                    </span>
                  </button>
                );
              })}
              {goals.length > 0 && <p className="text-[13px] text-muted">Sans objectif choisi, l&apos;épargne reste « libre ».</p>}
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
              max={addDays(today, MAX_DAYS_AHEAD)}
              onChange={(event) => event.target.value && setOtherDate(event.target.value)}
              className="mt-3 animate-fade font-medium"
            />
          )}
          {isFuture && (
            <p className="mt-2 text-[13px] text-muted">Date à venir : l&apos;opération apparaîtra dans « À venir » et sera déjà déduite de ton disponible.</p>
          )}
        </FormField>

        {editing ? (
          editing.recurrenceId && (
            <p className="rounded-2xl bg-lilac-50 px-4 py-3 text-[13px] text-ink-soft">
              Cette opération fait partie d&apos;une récurrence : seule cette occurrence est modifiée.
            </p>
          )
        ) : (
          <FormField label="Récurrence">
            <div className="flex flex-wrap gap-2">
              {recurrenceOptions.map((option) => (
                <ChoiceChip key={option.value} selected={recurrence === option.value} onClick={() => setRecurrence(option.value)}>
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
          </FormField>
        )}

        {accountOptions.length > 0 && (
          <FormField label={kind === "saving" ? "Depuis le compte" : "Compte"}>
            <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
              {accountOptions.map((account) => (
                <ChoiceChip key={account.id} selected={account.id === accountId} onClick={() => setAccountId(account.id)}>
                  <span aria-hidden>{account.emoji}</span>
                  {account.label}
                </ChoiceChip>
              ))}
            </div>
          </FormField>
        )}
        {kind === "saving" && (
          <FormField label="Vers le compte d'épargne">
            {destinationOptions.length > 0 ? (
              <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
                {destinationOptions.map((account) => (
                  <ChoiceChip key={account.id} selected={account.id === transferAccountId} onClick={() => setTransferAccountId(account.id)}>
                    <span aria-hidden>{account.emoji}</span>
                    {account.label}
                  </ChoiceChip>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
                Aucun compte d&apos;épargne actif : réactive ton Livret A dans Paramètres → Mes comptes pour y verser ton épargne.
              </p>
            )}
            <p className="mt-2 text-[13px] text-muted">Un transfert entre tes comptes : ton patrimoine ne change pas, l&apos;argent passe sur ton épargne.</p>
          </FormField>
        )}
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={pending || undefined}>
          {pending
            ? "Enregistrement…"
            : canSubmit
              ? editing
                ? `Enregistrer ${formatMoney(signed, { sign: "always" })}`
                : `Ajouter ${formatMoney(signed, { sign: "always" })}`
              : amount > 0
                ? needsDestination
                  ? "Choisis le compte d'épargne"
                  : "Choisis une catégorie"
                : "Saisis un montant"}
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
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title={active?.preset.transaction ? "Modifier l'opération" : "Nouvelle opération"}>
      {active && <AddTransactionForm key={sheetSession} preset={active.preset} />}
    </Sheet>
  );
}
