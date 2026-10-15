"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
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
import { addDays, formatDayHeading } from "@/lib/dates";
import { formatMoney, formatPercent, parseAmountInput } from "@/lib/format";
import { errorMessage } from "@/services/repository";
import { useBudget } from "@/store/budget-store";
import { accountChoices, destinationChoices, preferredAccountId, preferredDestinationId } from "@/lib/accounts";
import { knownLabels, matchMerchant, rankCategories } from "@/lib/suggestions";
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

/** Catégories montrées d'emblée (les plus utilisées) ; les autres derrière « Toutes les catégories ». */
const QUICK_CATEGORIES = 4;

const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: "none", label: "Non" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "monthly", label: "Chaque mois" },
];

function AddTransactionForm({ preset }: { preset: AddPreset }) {
  const { today, categories, goals, accounts, allTransactions, addTransaction, updateTransaction, removeTransaction } = useBudget();
  const { closeSheet, showToast, showError, highlight } = useUI();
  const editing: Transaction | undefined = preset.transaction;

  const [kind, setKind] = useState<TransactionKind>(editing?.kind ?? preset.kind ?? "expense");

  const [amountText, setAmountText] = useState(amountToInput(editing?.amount));
  const [label, setLabel] = useState(editing?.label ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const initialKind: TransactionKind = editing?.kind ?? preset.kind ?? "expense";
  // Suggestion locale : la catégorie la plus utilisée récemment pour ce type (jamais pour une modification).
  const suggestFor = (forKind: TransactionKind): CategoryId | null => {
    if (forKind === "saving") return null;
    const allowed = categories.filter((c) => !c.archived && (forKind === "income" ? c.group === "revenus" : isExpenseCategory(c))).map((c) => c.id);
    const used = allTransactions.some((t) => t.kind === forKind && t.date <= today && allowed.includes(t.categoryId));
    return used ? (rankCategories(allTransactions, forKind, today, allowed)[0] ?? null) : null;
  };
  const [categoryId, setCategoryId] = useState<CategoryId | null>(
    editing ? (editing.kind !== "saving" ? editing.categoryId : null) : suggestFor(initialKind),
  );
  /** D'où vient la catégorie affichée : habitude, marchand reconnu, ou choix explicite. */
  const [categorySource, setCategorySource] = useState<"habit" | "merchant" | "user">(editing ? "user" : "habit");
  const [accountTouched, setAccountTouched] = useState(Boolean(editing));
  const [showAllCategories, setShowAllCategories] = useState(Boolean(editing));
  const [moreOpen, setMoreOpen] = useState(Boolean(editing));
  const optionsId = useId();
  const labelsId = useId();
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
  const ranked = useMemo(
    () => rankCategories(allTransactions, kind, today, categoryOptions.map((c) => c.id)),
    // categoryOptions dérive de categories et kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTransactions, kind, today, categories, editing?.categoryId],
  );
  const quick = ranked.slice(0, QUICK_CATEGORIES);
  if (categoryId && !quick.includes(categoryId) && ranked.includes(categoryId)) quick[quick.length - 1] = categoryId;
  const collapsible = categoryOptions.length > QUICK_CATEGORIES + 1;
  const shownCategories = !collapsible || showAllCategories ? categoryOptions : categoryOptions.filter((c) => quick.includes(c.id)).sort((a, b) => quick.indexOf(a.id) - quick.indexOf(b.id));
  const labels = useMemo(() => knownLabels(allTransactions, kind, today), [allTransactions, kind, today]);
  // Comptes actifs hors épargne (source d'une épargne) ; le compte d'origine reste proposé en modification.
  const accountOptions = accountChoices(accounts, kind, editing?.accountId);
  const destinationOptions = destinationChoices(accounts, editing?.transferAccountId);
  const needsCategory = kind !== "saving";
  const needsDestination = kind === "saving";
  const canSubmit = amount > 0 && (!needsCategory || categoryId !== null) && (!needsDestination || transferAccountId !== undefined) && !pending;
  const signed = kind === "income" ? amount : -amount;
  const copy = kindCopy[kind];
  const isFuture = date > today;
  const accountLabel = accountOptions.find((a) => a.id === accountId)?.label;
  const optionsSummary = [
    label.trim() || null,
    dateChoice === "other" ? formatDayHeading(date, today) : dateChoice === "yesterday" ? "Hier" : "Aujourd'hui",
    kind !== "saving" && accountLabel ? accountLabel : null,
    !editing && recurrence !== "none" ? recurrenceOptions.find((o) => o.value === recurrence)?.label.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /** Description saisie : un marchand déjà vu reprend sa catégorie et son compte, sauf choix explicite. */
  function changeLabel(next: string) {
    setLabel(next);
    if (editing) return;
    const match = matchMerchant(allTransactions, kind, next, today);
    if (!match) return;
    if (categorySource !== "user" && categoryOptions.some((c) => c.id === match.categoryId)) {
      setCategoryId(match.categoryId);
      setCategorySource("merchant");
    }
    if (!accountTouched && accountOptions.some((a) => a.id === match.accountId)) setAccountId(match.accountId);
  }

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
            setCategoryId(editing ? null : suggestFor(next));
            setCategorySource(editing ? "user" : "habit");
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
              if (reading.merchant && !label.trim()) changeLabel(reading.merchant);
              if (reading.date && reading.date !== today) {
                if (reading.date === addDays(today, -1)) setDateChoice("yesterday");
                else {
                  setDateChoice("other");
                  setOtherDate(reading.date);
                }
              }
              // Magasin et date lus : visibles tout de suite pour être vérifiés.
              if (reading.merchant || reading.date) setMoreOpen(true);
            }}
          />
        )}

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
              {shownCategories.map((category) => {
                const selected = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCategoryId(category.id);
                      setCategorySource("user");
                    }}
                    className={cn(
                      "flex min-h-[4.75rem] min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 max-[359px]:px-0.5 transition-all duration-200 active:scale-[0.96]",
                      selected ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
                    )}
                  >
                    <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
                    <span className="line-clamp-2 w-full text-center text-[12px] font-semibold leading-tight [overflow-wrap:normal] max-[359px]:text-[11px]">{category.shortLabel ?? category.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="min-h-5 text-[13px] text-muted" aria-live="polite">
                {!editing && categoryId && categorySource === "habit"
                  ? "Suggérée d'après tes habitudes : touche une autre catégorie si besoin."
                  : !editing && categoryId && categorySource === "merchant"
                    ? `Reconnue d'après « ${label.trim()} ».`
                    : ""}
              </p>
              {collapsible && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((open) => !open)}
                  aria-expanded={showAllCategories}
                  className="-mr-3 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-blush-700 transition-colors hover:bg-blush-50"
                >
                  {showAllCategories ? "Moins de catégories" : `Toutes les catégories (${categoryOptions.length})`}
                  <ChevronDown size={15} className={cn("transition-transform", showAllCategories && "rotate-180")} aria-hidden />
                </button>
              )}
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
            <p className="mt-2 text-[13px] text-muted">Un transfert entre tes comptes : tout ton argent ne change pas, il passe sur ton épargne.</p>
          </FormField>
        )}

        <div className="-mx-2 rounded-3xl bg-canvas/70">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls={optionsId}
            aria-label="Plus d'options"
            aria-describedby={`${optionsId}-summary`}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-3xl px-4 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">Plus d&apos;options</span>
              <span id={`${optionsId}-summary`} className="block break-words text-[13px] text-muted">
                {moreOpen ? "Description, note, date, répétition, compte" : optionsSummary}
              </span>
            </span>
            <ChevronDown size={18} className={cn("shrink-0 text-muted transition-transform", moreOpen && "rotate-180")} aria-hidden />
          </button>

          {moreOpen && (
            <div id={optionsId} className="flex animate-fade flex-col gap-6 px-4 pb-5 pt-2">
              <label className="block">
                <span className="mb-2.5 block text-sm font-semibold text-muted">
                  Description <span className="font-medium">(facultatif)</span>
                </span>
                <TextInput
                  value={label}
                  onChange={(event) => changeLabel(event.target.value)}
                  placeholder={copy.placeholder}
                  maxLength={40}
                  list={labels.length > 0 ? labelsId : undefined}
                  autoComplete="off"
                />
                {labels.length > 0 && (
                  <datalist id={labelsId}>
                    {labels.map((known) => (
                      <option key={known} value={known} />
                    ))}
                  </datalist>
                )}
              </label>
              <label className="block">
                <span className="mb-2.5 block text-sm font-semibold text-muted">
                  Note <span className="font-medium">(facultatif)</span>
                </span>
                <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="Un détail à retenir" maxLength={280} />
              </label>

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
                  <p className="mt-2 text-[13px] text-muted">
                    Date à venir : l&apos;opération apparaîtra dans « Prochainement » et sera déjà comptée dans ce que tu peux encore dépenser.
                  </p>
                )}
              </FormField>

              {editing ? (
                editing.recurrenceId && (
                  <p className="rounded-2xl bg-lilac-50 px-4 py-3 text-[13px] text-ink-soft">
                    Cette opération se répète : seule cette occurrence est modifiée.
                  </p>
                )
              ) : (
                <FormField label="Se répète">
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
                  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                    {accountOptions.map((account) => (
                      <ChoiceChip
                        key={account.id}
                        selected={account.id === accountId}
                        onClick={() => {
                          setAccountId(account.id);
                          setAccountTouched(true);
                        }}
                      >
                        <span aria-hidden>{account.emoji}</span>
                        {account.label}
                      </ChoiceChip>
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          )}
        </div>
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
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title={active?.preset.transaction ? "Modifier l'opération" : "Ajouter"}>
      {active && <AddTransactionForm key={sheetSession} preset={active.preset} />}
    </Sheet>
  );
}
