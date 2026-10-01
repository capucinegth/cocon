"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { getAccount, quickAddAccountIds } from "@/config/accounts";
import { expenseCategoryIds, getCategory, incomeCategoryIds } from "@/config/categories";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";
import { formatMoney, parseAmountInput } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { AccountId, CategoryId } from "@/types/finance";

type Kind = "expense" | "income";
type DateChoice = "today" | "yesterday" | "other";

/** Garde uniquement chiffres + une virgule, 2 décimales max. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const [units = "", ...rest] = cleaned.split(",");
  const trimmedUnits = units.replace(/^0+(?=\d)/, "").slice(0, 6);
  return rest.length ? `${trimmedUnits || "0"},${rest.join("").slice(0, 2)}` : trimmedUnits;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-sm font-semibold text-muted">{label}</legend>
      {children}
    </fieldset>
  );
}

function AddTransactionForm({ onDone }: { onDone: (message: string) => void }) {
  const { today, addTransaction } = useBudget();
  const [kind, setKind] = useState<Kind>("expense");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [accountId, setAccountId] = useState<AccountId>("courant");
  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [otherDate, setOtherDate] = useState(addDays(today, -2));
  const [note, setNote] = useState("");

  const amount = parseAmountInput(amountText);
  const date = dateChoice === "today" ? today : dateChoice === "yesterday" ? addDays(today, -1) : otherDate;
  const canSubmit = amount > 0 && categoryId !== null;
  const categoryIds = kind === "expense" ? expenseCategoryIds : incomeCategoryIds;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || categoryId === null) return;
    addTransaction({ amount, kind, categoryId, accountId, date, note });
    onDone(kind === "expense" ? "Dépense ajoutée" : "Revenu ajouté");
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
          options={[
            { value: "expense", label: "Dépense" },
            { value: "income", label: "Revenu" },
          ]}
          className="w-full"
        />

        {/* Montant — l'élément principal, saisi en premier */}
        <label className="flex items-baseline justify-center gap-2 rounded-3xl bg-canvas px-4 py-7">
          <span className="sr-only">Montant en euros</span>
          <span aria-hidden className="text-3xl font-semibold text-muted">
            {kind === "expense" ? "−" : "+"}
          </span>
          {/* Le champ prend exactement la largeur de son texte grâce à un « miroir » invisible. */}
          <span className="inline-grid text-[52px] font-semibold leading-none tracking-tight">
            <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
              {amountText || "0"}
            </span>
            <input
              data-autofocus
              size={1}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              onChange={(event) => setAmountText(sanitizeAmount(event.target.value))}
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-center outline-none placeholder:text-ink/20"
            />
          </span>
          <span aria-hidden className="text-3xl font-semibold">
            €
          </span>
        </label>

        <Field label="Catégorie">
          <div className="grid grid-cols-4 gap-2">
            {categoryIds.map((id) => {
              const category = getCategory(id);
              const selected = id === categoryId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryId(id)}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition-all duration-200 active:scale-[0.96]",
                    selected ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
                  )}
                >
                  <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
                  <span className="w-full truncate text-center text-[12px] font-semibold">
                    {category.shortLabel ?? category.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Compte">
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
        </Field>

        <Field label="Date">
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
            <input
              type="date"
              aria-label="Choisir une date"
              value={otherDate}
              max={today}
              onChange={(event) => event.target.value && setOtherDate(event.target.value)}
              className="mt-3 h-12 w-full animate-fade rounded-2xl bg-canvas px-4 text-[15px] font-medium outline-none focus:ring-2 focus:ring-blush-300"
            />
          )}
        </Field>

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Note <span className="font-medium">(facultatif)</span>
          </span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={kind === "expense" ? "Ex. Dîner chez Léa" : "Ex. Remboursement"}
            maxLength={60}
            className="h-12 w-full rounded-2xl bg-canvas px-4 text-[15px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-blush-300"
          />
        </label>
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
          {canSubmit
            ? `Ajouter ${formatMoney(kind === "expense" ? -amount : amount, { sign: "always" })}`
            : amount > 0
              ? "Choisis une catégorie"
              : "Saisis un montant"}
        </Button>
      </div>
    </form>
  );
}

/** Feuille d'ajout rapide, ouverte depuis n'importe quel écran. */
export function AddTransactionSheet() {
  const { isAddOpen, addSession, closeAdd, showToast } = useUI();

  return (
    <Sheet open={isAddOpen} onClose={closeAdd} title="Nouvelle opération">
      <AddTransactionForm
        key={addSession}
        onDone={(message) => {
          closeAdd();
          showToast(message);
        }}
      />
    </Sheet>
  );
}
