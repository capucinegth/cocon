"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AmountInput, FormField, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { useAsyncAction } from "@/hooks/use-async-action";
import { planFor } from "@/lib/budget";
import { formatMonth } from "@/lib/dates";
import { parseAmountInput, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

function TargetsForm({ month }: { month: string }) {
  const data = useBudget();
  const { closeSheet, showToast } = useUI();
  const plan = planFor(data, month);
  const [incomeText, setIncomeText] = useState(amountToInput(plan?.incomeTarget));
  const [savingsText, setSavingsText] = useState(amountToInput(plan?.savingsTarget));
  const { pending, error, run } = useAsyncAction();
  const incomeTarget = roundCents(parseAmountInput(incomeText));
  const savingsTarget = roundCents(parseAmountInput(savingsText));
  const changed = incomeTarget !== (plan?.incomeTarget ?? 0) || savingsTarget !== (plan?.savingsTarget ?? 0) || plan?.inherited;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const ok = await run(() => data.setMonthTargets(month, { incomeTarget, savingsTarget }));
    if (!ok) return;
    closeSheet();
    showToast("Budget du mois mis à jour");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <p className="text-[14px] text-muted">
          Pour {formatMonth(month).toLowerCase()}. Ce que tu attends ce mois-ci (ton salaire, par exemple) : tant qu&apos;il n&apos;est pas saisi, Cocon le compte dans ce que tu peux encore dépenser.
        </p>
        <FormField label="Revenus prévus" as="div">
          <AmountInput label="Revenus prévus en euros" value={incomeText} onChange={setIncomeText} size="md" autoFocus />
        </FormField>
        <FormField label="Épargne prévue" as="div">
          <AmountInput label="Épargne prévue en euros" value={savingsText} onChange={setSavingsText} size="md" />
          <p className="mt-2 text-[13px] text-muted">Mise de côté dès le début du mois, pour tes objectifs.</p>
        </FormField>
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!changed || pending} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

/** Revenus et épargne prévus pour un mois. */
export function TargetsSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "targets" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Revenus et épargne prévus">
      {active && <TargetsForm key={sheetSession} month={active.month} />}
    </Sheet>
  );
}
