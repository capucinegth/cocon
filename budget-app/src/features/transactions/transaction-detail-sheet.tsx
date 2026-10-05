"use client";

import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { Sheet } from "@/components/ui/sheet";
import { getAccount } from "@/config/accounts";
import { signedAmount } from "@/lib/budget";
import { formatLongDate } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { Transaction } from "@/types/finance";

const kindLabels: Record<Transaction["kind"], string> = { expense: "Dépense", income: "Revenu", saving: "Épargne" };
const recurrenceLabels = { none: "Une fois", weekly: "Chaque semaine", monthly: "Chaque mois" };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[15px] font-medium">{children}</dd>
    </div>
  );
}

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  const { goals, removeTransaction, restoreTransaction } = useBudget();
  const categoryOf = useCategoryLookup();
  const { closeSheet, showToast } = useUI();
  const category = categoryOf(transaction.categoryId);
  const goal = goals.find((g) => g.id === transaction.goalId);
  const amount = signedAmount(transaction);

  return (
    <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">
      <div className="flex flex-col items-center rounded-3xl bg-canvas px-4 py-6 text-center">
        <CategoryBadge emoji={goal?.emoji ?? category.emoji} tone={goal?.tone ?? category.tone} size="lg" />
        <p className="mt-3 text-lg font-semibold">{transaction.label}</p>
        <Money
          value={amount}
          sign="always"
          cents="always"
          className={amount > 0 ? "mt-1 text-[34px] font-semibold tracking-tight text-sage-700" : "mt-1 text-[34px] font-semibold tracking-tight"}
        />
      </div>

      <dl className="mt-4 divide-y divide-line">
        <Row label="Type">{kindLabels[transaction.kind]}</Row>
        <Row label="Catégorie">
          {category.emoji} {category.label}
        </Row>
        {goal && (
          <Row label="Objectif">
            {goal.emoji} {goal.label}
          </Row>
        )}
        <Row label="Date">{formatLongDate(transaction.date)}</Row>
        <Row label="Compte">{getAccount(transaction.accountId).label}</Row>
        <Row label="Récurrence">{recurrenceLabels[transaction.recurrence ?? "none"]}</Row>
        {transaction.note && <Row label="Note">{transaction.note}</Row>}
      </dl>

      <div className="mt-5 flex gap-3">
        <Button variant="soft" className="flex-1" onClick={closeSheet}>
          Fermer
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          onClick={() => {
            removeTransaction(transaction);
            closeSheet();
            showToast("Opération supprimée", { label: "Annuler", onAction: () => restoreTransaction(transaction) });
          }}
        >
          <Trash2 size={17} aria-hidden />
          Supprimer
        </Button>
      </div>
    </div>
  );
}

/** Détail d'une opération (ouvert en touchant une ligne). */
export function TransactionDetailSheet() {
  const { sheet, isSheetOpen, closeSheet } = useUI();
  const transaction = sheet?.type === "transaction" ? sheet.transaction : null;

  return (
    <Sheet open={isSheetOpen && transaction !== null} onClose={closeSheet} title="Détail de l'opération">
      {transaction && <TransactionDetail transaction={transaction} />}
    </Sheet>
  );
}
