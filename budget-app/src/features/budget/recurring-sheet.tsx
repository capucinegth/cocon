"use client";

import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AmountInput, FormField, TextInput, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectPill } from "@/components/ui/select-pill";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { isExpenseCategory } from "@/config/categories";
import { useAsyncAction } from "@/hooks/use-async-action";
import { accountChoices, destinationChoices, ruleAccountsActive } from "@/lib/accounts";
import { formatLongDate } from "@/lib/dates";
import { parseAmountInput, roundCents } from "@/lib/format";
import { firstOccurrenceFrom } from "@/lib/recurrence";
import { resolveRecurringPatch, type RecurringPatch } from "@/store/budget-state";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { RecurringRule } from "@/types/finance";

const kindLabel = { expense: "Dépense", income: "Revenu", saving: "Épargne" } as const;

/** « le 31 » tombe le dernier jour des mois plus courts. */
const monthlyHint = (day: number) => `Puis le ${day} de chaque mois${day > 28 ? " (ou le dernier jour du mois s'il est plus court)" : ""}.`;

function RecurringForm({ ruleId }: { ruleId: string }) {
  const { recurring, categories, accounts, today, updateRecurring, removeRecurring } = useBudget();
  const categoryOf = useCategoryLookup();
  const { closeSheet, showToast } = useUI();
  const rule = recurring.find((r) => r.id === ruleId);
  // Une règle en pause dont l'échéance est passée : on propose sa prochaine échéance à partir d'aujourd'hui.
  const shownDate = rule ? (rule.nextOccurrence < today ? firstOccurrenceFrom(rule, today) : rule.nextOccurrence) : today;

  const [label, setLabel] = useState(rule?.label ?? "");
  const [amountText, setAmountText] = useState(amountToInput(rule?.amount));
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>(rule?.frequency ?? "monthly");
  const [date, setDate] = useState(shownDate);
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [accountId, setAccountId] = useState(rule?.accountId ?? "");
  const [transferAccountId, setTransferAccountId] = useState<string | undefined>(rule?.transferAccountId);
  const [isActive, setActive] = useState(rule?.isActive ?? true);
  const save = useAsyncAction();
  const remove = useAsyncAction();

  if (!rule) {
    return <p className="px-6 pb-8 pt-2 text-[15px] text-muted">Cette opération récurrente n&apos;existe plus.</p>;
  }

  const category = categoryOf(categoryId);
  const amount = roundCents(parseAmountInput(amountText));
  const categoryOptions = categories.filter(
    (c) => (!c.archived || c.id === rule.categoryId) && (rule.kind === "income" ? c.group === "revenus" : isExpenseCategory(c)),
  );
  const accountOptions = accountChoices(accounts, rule.kind, rule.accountId);
  const destinationOptions = destinationChoices(accounts, rule.transferAccountId);
  // Une récurrence ne génère rien sur un compte désactivé : elle ne peut pas être réactivée tant qu'il l'est.
  const accountsActive = ruleAccountsActive({ accountId, transferAccountId }, accounts);

  const patch: RecurringPatch = {};
  if (label.trim() !== rule.label) patch.label = label.trim();
  if (amount !== rule.amount) patch.amount = amount;
  if (frequency !== rule.frequency) patch.frequency = frequency;
  if (date !== shownDate) patch.nextOccurrence = date;
  if (categoryId !== rule.categoryId) patch.categoryId = categoryId;
  if (accountId !== rule.accountId) patch.accountId = accountId;
  if (transferAccountId !== rule.transferAccountId) patch.transferAccountId = transferAccountId;
  if (isActive !== rule.isActive) patch.isActive = isActive;
  const changed = Object.keys(patch).length > 0;
  // Une ancienne épargne récurrente sans destination peut être mise en pause ou supprimée ; active, elle doit en avoir une.
  const destinationMissing = rule.kind === "saving" && isActive && !transferAccountId;
  const canSubmit =
    label.trim().length > 0 && amount > 0 && date >= today && changed && !destinationMissing && !(isActive && !accountsActive) && !save.pending;
  // Ce qui sera réellement enregistré (reprise après une pause : prochaine échéance à partir d'aujourd'hui).
  const preview = resolveRecurringPatch(rule, patch, today);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await save.run(() => updateRecurring(ruleId, patch));
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
              {isActive ? `Prochaine le ${formatLongDate(preview.nextOccurrence ?? date).toLowerCase()}` : "En pause"}
            </p>
          </div>
        </div>
        <FormField label="Montant" as="div">
          <AmountInput label="Montant en euros" value={amountText} onChange={setAmountText} size="md" prefix={rule.kind === "income" ? "+" : "−"} />
          <p className="mt-2 text-[13px] text-muted">
            Les changements s&apos;appliquent aux prochaines échéances ; les opérations déjà passées ne changent pas.
          </p>
        </FormField>
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Description</span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
        </label>
        <FormField label="Fréquence">
          <SegmentedControl
            label="Fréquence"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: "monthly", label: "Chaque mois" },
              { value: "weekly", label: "Chaque semaine" },
            ]}
            className="w-full"
          />
        </FormField>
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Prochaine échéance</span>
          <TextInput
            type="date"
            value={date}
            min={today}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="font-medium"
          />
          <span className="mt-2 block text-[13px] text-muted">
            {frequency === "monthly" ? monthlyHint(preview.anchorDay ?? Number(date.slice(8, 10))) : "Puis chaque semaine, le même jour."}
          </span>
        </label>
        {rule.kind !== "saving" && (
          <FormField label="Catégorie" as="div">
            <SelectPill
              label="Catégorie"
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}${c.archived ? " (archivée)" : ""}` }))}
              className="w-full"
            />
          </FormField>
        )}
        {accountOptions.length > 0 && (
          <FormField label={rule.kind === "saving" ? "Depuis le compte" : "Compte"}>
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
        {rule.kind === "saving" && (
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
              <p className="rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">Aucun compte d&apos;épargne actif : réactive ton Livret A dans Mes comptes.</p>
            )}
          </FormField>
        )}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
          <span>
            <span className="block text-[15px] font-semibold">Active</span>
            <span className="block text-[13px] text-muted">
              {!accountsActive
                ? "Un de ses comptes est désactivé : rien n'est ajouté. Choisis un compte actif pour la réactiver."
                : !rule.isActive && isActive
                  ? "Reprise sans rattrapage : les échéances de la pause ne sont pas ajoutées."
                  : "En pause, plus rien n'est ajouté automatiquement."}
            </span>
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

/** Loyer, salaire, abonnement… : montant, description, rythme, échéance, catégorie, compte, pause ou suppression. */
export function RecurringSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "recurring" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Opération récurrente">
      {active && <RecurringForm key={sheetSession} ruleId={active.ruleId} />}
    </Sheet>
  );
}
