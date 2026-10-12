"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AmountInput, FormField, TextInput, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Money } from "@/components/ui/money";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { isLiquidAccount } from "@/config/accounts";
import { useAsyncAction } from "@/hooks/use-async-action";
import { accountBalance, accountTypeLabel, canDeactivateAccount } from "@/lib/accounts";
import { parseAmountInput, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

type Sign = "positive" | "negative";

function AccountForm({ accountId }: { accountId: string }) {
  const { accounts, allTransactions, today, updateAccount, moveAccount } = useBudget();
  const { closeSheet, showToast } = useUI();
  const account = accounts.find((a) => a.id === accountId);
  const index = accounts.findIndex((a) => a.id === accountId);

  const [label, setLabel] = useState(account?.label ?? "");
  const [balanceText, setBalanceText] = useState(amountToInput(Math.abs(account?.initialBalance ?? 0)));
  const [sign, setSign] = useState<Sign>((account?.initialBalance ?? 0) < 0 ? "negative" : "positive");
  const [isActive, setActive] = useState(account?.isActive ?? true);
  const [position, setPosition] = useState(index);
  const { pending, error, run } = useAsyncAction();

  if (!account) {
    return <p className="px-6 pb-8 pt-2 text-[15px] text-muted">Ce compte n&apos;existe plus.</p>;
  }

  const liquid = isLiquidAccount(account);
  const initialBalance = roundCents(parseAmountInput(balanceText) * (sign === "negative" ? -1 : 1));
  const deactivationBlocked = account.isActive && !canDeactivateAccount(accounts, account.id);
  const changedFields = label.trim() !== account.label || initialBalance !== account.initialBalance || isActive !== account.isActive;
  const changedPosition = position !== index;
  const canSubmit = label.trim().length > 0 && (changedFields || changedPosition) && !pending;
  const current = accountBalance({ id: account.id, initialBalance }, allTransactions, today);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await run(async () => {
      if (changedFields) await updateAccount(account!.id, { label: label.trim(), initialBalance, isActive });
      if (changedPosition) await moveAccount(account!.id, position);
    });
    if (!ok) return;
    closeSheet();
    showToast(isActive ? `« ${label.trim()} » mis à jour` : `« ${label.trim()} » désactivé`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-2xl">
            {account.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold">{label.trim() || account.label}</p>
            <p className="text-[13px] text-muted">{accountTypeLabel[account.type]}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] font-medium text-muted">Solde calculé</p>
            <Money value={current} cents="always" className="tabular text-[15px] font-semibold" />
          </div>
        </div>

        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom</span>
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} />
        </label>

        <FormField label="Solde de départ" as="div">
          <AmountInput label="Solde de départ en euros" value={balanceText} onChange={setBalanceText} size="md" prefix={sign === "negative" ? "−" : undefined} />
          {liquid && (
            <SegmentedControl
              label="Signe du solde de départ"
              value={sign}
              onChange={setSign}
              options={[
                { value: "positive", label: "Positif" },
                { value: "negative", label: "Négatif (découvert)" },
              ]}
              size="sm"
              className="mt-3 w-full"
            />
          )}
          <p className="mt-2 text-[13px] text-muted">
            Ce qu&apos;il y avait sur ce compte quand tu as commencé à le suivre dans Cocon. Le solde calculé y ajoute les opérations saisies sur ce compte.
          </p>
        </FormField>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
          <span>
            <span className="block text-[15px] font-semibold">Actif</span>
            <span className="block text-[13px] text-muted">
              {deactivationBlocked
                ? "Garde au moins un compte actif hors épargne pour saisir tes opérations."
                : "Désactivé, il n'est plus proposé pour les nouvelles opérations. Son historique est conservé."}
            </span>
          </span>
          {deactivationBlocked ? (
            <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[12px] font-semibold text-sage-700">Actif</span>
          ) : (
            <Toggle checked={isActive} onChange={setActive} label="Compte actif" />
          )}
        </div>

        {accounts.length > 1 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
            <span>
              <span className="block text-[15px] font-semibold">Ordre d&apos;affichage</span>
              <span className="block text-[13px] text-muted">
                Position {position + 1} sur {accounts.length}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button variant="white" size="icon" onClick={() => setPosition((p) => Math.max(p - 1, 0))} disabled={position === 0} aria-label="Monter le compte">
                <ArrowUp size={18} aria-hidden />
              </Button>
              <Button
                variant="white"
                size="icon"
                onClick={() => setPosition((p) => Math.min(p + 1, accounts.length - 1))}
                disabled={position === accounts.length - 1}
                aria-label="Descendre le compte"
              >
                <ArrowDown size={18} aria-hidden />
              </Button>
            </span>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Enregistrement…" : label.trim() ? "Enregistrer" : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

/** Un compte : nom, solde de départ, actif / désactivé, ordre d'affichage. */
export function AccountSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "account" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title="Modifier le compte">
      {active && <AccountForm key={sheetSession} accountId={active.accountId} />}
    </Sheet>
  );
}
