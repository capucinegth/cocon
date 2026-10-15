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
import { ChoiceChip } from "@/components/ui/choice-chip";
import { accountTypeEmoji, isLiquidAccount } from "@/config/accounts";
import { useAsyncAction } from "@/hooks/use-async-action";
import { accountBalance, accountTypeLabel, activeRulesUsingAccount, canDeactivateAccount } from "@/lib/accounts";
import { parseAmountInput, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { AccountType } from "@/types/finance";

type Sign = "positive" | "negative";

function AccountForm({ accountId }: { accountId: string }) {
  const { accounts, allTransactions, recurring, today, updateAccount, moveAccount } = useBudget();
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
  // Récurrences actives sur ce compte : mises en pause automatiquement s'il est désactivé.
  const rulesToPause = account.isActive && !isActive ? activeRulesUsingAccount(recurring, account.id) : [];
  const changedFields = label.trim() !== account.label || initialBalance !== account.initialBalance || isActive !== account.isActive;
  const changedPosition = position !== index;
  const canSubmit = label.trim().length > 0 && (changedFields || changedPosition) && !pending;
  const current = accountBalance({ id: account.id, initialBalance }, allTransactions, today);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    let paused = 0;
    const ok = await run(async () => {
      if (changedFields) paused = await updateAccount(account!.id, { label: label.trim(), initialBalance, isActive });
      if (changedPosition) await moveAccount(account!.id, position);
    });
    if (!ok) return;
    closeSheet();
    const pausedText = paused > 0 ? ` · ${paused} récurrence${paused > 1 ? "s" : ""} en pause` : "";
    showToast(isActive ? `« ${label.trim()} » mis à jour` : `« ${label.trim()} » désactivé${pausedText}`);
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
            <p className="text-[13px] text-muted">{account.isActive ? accountTypeLabel[account.type] : `${accountTypeLabel[account.type]} · désactivé`}</p>
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
            Ce qu&apos;il y avait sur ce compte quand tu as commencé à le suivre dans Cocon.{" "}
            {liquid
              ? "Le solde calculé y ajoute les opérations saisies sur ce compte."
              : "Le solde calculé y ajoute les versements d'épargne reçus (transferts depuis tes autres comptes)."}
          </p>
        </FormField>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
          <span>
            <span className="block text-[15px] font-semibold">Actif</span>
            <span className="block text-[13px] text-muted">
              {deactivationBlocked
                ? "Garde au moins un compte actif hors épargne pour saisir tes opérations."
                : rulesToPause.length > 0
                  ? `${rulesToPause.length} récurrence${rulesToPause.length > 1 ? "s" : ""} active${rulesToPause.length > 1 ? "s" : ""} sur ce compte ${rulesToPause.length > 1 ? "seront mises" : "sera mise"} en pause. L'historique est conservé.`
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

const typeChoices: AccountType[] = ["checking", "savings", "cash", "joint", "other"];

/** Nouveau compte : nom, type, solde de départ. Il est ajouté à la fin de la liste, actif. */
function NewAccountForm() {
  const { addAccount, accounts } = useBudget();
  const { closeSheet, showToast } = useUI();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [balanceText, setBalanceText] = useState("");
  const [sign, setSign] = useState<Sign>("positive");
  const { pending, error, run } = useAsyncAction();

  const liquid = type !== "savings";
  const initialBalance = roundCents(parseAmountInput(balanceText) * (liquid && sign === "negative" ? -1 : 1));
  const duplicate = accounts.some((a) => a.label.trim().toLocaleLowerCase("fr") === label.trim().toLocaleLowerCase("fr"));
  const canSubmit = label.trim().length > 0 && !duplicate && !pending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const ok = await run(async () => {
      await addAccount({ label, type, initialBalance });
    });
    if (!ok) return;
    closeSheet();
    showToast(`Compte « ${label.trim()} » créé`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">Nom</span>
          <TextInput data-autofocus value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="Ex. Compte Boursorama, LDDS…" />
        </label>
        <FormField label="Type de compte">
          <div className="flex flex-wrap gap-2">
            {typeChoices.map((choice) => (
              <ChoiceChip key={choice} selected={choice === type} onClick={() => setType(choice)}>
                <span aria-hidden>{accountTypeEmoji[choice]}</span>
                {accountTypeLabel[choice]}
              </ChoiceChip>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {liquid
              ? "Proposé pour tes revenus et dépenses, et comme source de ton épargne."
              : "Un compte d'épargne reçoit tes versements d'épargne (transferts depuis tes autres comptes)."}
          </p>
        </FormField>
        <FormField label="Solde de départ" as="div">
          <AmountInput label="Solde de départ en euros" value={balanceText} onChange={setBalanceText} size="md" prefix={liquid && sign === "negative" ? "−" : undefined} />
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
          <p className="mt-2 text-[13px] text-muted">Ce qu&apos;il y a sur ce compte aujourd&apos;hui. Les opérations saisies ensuite s&apos;y ajoutent.</p>
        </FormField>
      </div>
      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={error} className="mb-3" />
        <Button type="submit" size="lg" disabled={!canSubmit} className="w-full" aria-busy={pending || undefined}>
          {pending ? "Création…" : duplicate ? "Un compte porte déjà ce nom" : label.trim() ? "Créer le compte" : "Donne-lui un nom"}
        </Button>
      </div>
    </form>
  );
}

/** Un compte : création, ou modification (nom, solde de départ, actif / désactivé, ordre d'affichage). */
export function AccountSheet() {
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const active = sheet?.type === "account" ? sheet : null;

  return (
    <Sheet open={isSheetOpen && active !== null} onClose={closeSheet} title={active && !active.accountId ? "Nouveau compte" : "Modifier le compte"}>
      {active && (active.accountId ? <AccountForm key={sheetSession} accountId={active.accountId} /> : <NewAccountForm key={sheetSession} />)}
    </Sheet>
  );
}
