"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { AmountInput, FormField, TextInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SelectPill } from "@/components/ui/select-pill";
import { Sheet } from "@/components/ui/sheet";
import { isExpenseCategory } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { accountChoices, preferredAccountId } from "@/lib/accounts";
import { daysInMonth, formatLongDate } from "@/lib/dates";
import { formatMoney, parseAmountInput, roundCents } from "@/lib/format";
import { firstMonthlyDebit } from "@/lib/recurrence";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/** Jour du mois ce mois-ci (« le 31 » → dernier jour des mois plus courts). */
function thisMonthDate(day: number, today: string): string {
  return `${today.slice(0, 8)}${String(Math.min(day, daysInMonth(today))).padStart(2, "0")}`;
}

function FixedChargeForm() {
  const { categories, accounts, today, addFixedCharge } = useBudget();
  const { closeSheet, showToast } = useUI();
  const categoryOptions = categories.filter((c) => !c.archived && isExpenseCategory(c));
  const accountOptions = accountChoices(accounts, "expense");

  const [label, setLabel] = useState("");
  const [amountText, setAmountText] = useState("");
  const [dayText, setDayText] = useState("");
  const [categoryId, setCategoryId] = useState((categoryOptions.find((c) => c.group === "fixes") ?? categoryOptions[0])?.id ?? "");
  const [accountId, setAccountId] = useState(preferredAccountId(accounts));
  const { pending, error, run } = useAsyncAction();

  const amount = roundCents(parseAmountInput(amountText));
  const day = Number(dayText);
  const validDay = /^\d{1,2}$/.test(dayText) && day >= 1 && day <= 31;
  const first = validDay ? firstMonthlyDebit(day, today) : null;
  const thisMonth = validDay ? thisMonthDate(day, today) : null;
  const alreadyPassed = thisMonth !== null && thisMonth < today;
  const canSubmit = label.trim().length > 0 && amount > 0 && validDay && categoryId !== "" && accountId !== "" && !pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await run(async () => {
      await addFixedCharge({ label, amount, categoryId, accountId, day });
    });
    if (!ok) return;
    closeSheet();
    showToast(`« ${label.trim()} » ajoutée · prochain prélèvement le ${formatLongDate(first!).toLowerCase()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom</span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="Ex. Loyer, Électricité, Netflix…" data-autofocus />
        </label>
        <FormField label="Montant prélevé" as="div">
          <AmountInput label="Montant en euros" value={amountText} onChange={setAmountText} size="md" prefix="−" />
        </FormField>
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Jour du prélèvement</span>
          <TextInput
            value={dayText}
            onChange={(event) => setDayText(event.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="Entre 1 et 31"
            aria-describedby="fixed-charge-day-hint"
            className="font-medium"
          />
          <span id="fixed-charge-day-hint" className="mt-2 block text-[13px] text-muted">
            {!validDay
              ? "Le même jour chaque mois (« 31 » = dernier jour des mois plus courts)."
              : alreadyPassed
                ? `Le prélèvement de ce mois (le ${formatLongDate(thisMonth!).toLowerCase()}) est déjà passé : il n'est pas déduit de ton solde actuel. Premier prélèvement compté : le ${formatLongDate(first!).toLowerCase()}.`
                : `Premier prélèvement : ${first === today ? "aujourd'hui" : `le ${formatLongDate(first!).toLowerCase()}`}, puis le ${day} de chaque mois.`}
          </span>
        </label>
        <FormField label="Catégorie" as="div">
          <SelectPill
            label="Catégorie"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}` }))}
            className="w-full"
          />
        </FormField>
        {accountOptions.length > 0 && (
          <FormField label="Compte prélevé">
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
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Enregistrement…" : amount > 0 ? `Ajouter la charge · ${formatMoney(-amount, { sign: "always" })}` : "Ajouter la charge"}
        </Button>
      </div>
    </form>
  );
}

/** Nouvelle charge fixe (loyer, abonnement…) : montant et jour de prélèvement, sans rattrapage du mois en cours. */
export function FixedChargeSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "fixedCharge";

  return (
    <Sheet open={isSheetOpen && active} onClose={closeSheet} title="Nouvelle charge fixe">
      {active && <FixedChargeForm key={sheetSession} />}
    </Sheet>
  );
}
