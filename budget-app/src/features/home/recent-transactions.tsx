"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TransactionRow } from "@/components/finance/transaction-row";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { monthTransactions, signedAmount, sortByDateDesc } from "@/lib/budget";
import { formatDayHeading } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/** Les dernières opérations du mois, et un accès à la liste complète. */
export function RecentTransactions({ month, limit = 5 }: { month: string; limit?: number }) {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const { openTransaction, highlightId } = useUI();
  const items = sortByDateDesc(monthTransactions(data, month)).slice(0, limit);

  return (
    <Card>
      <SectionHeader title="Transactions récentes" subtitle="Touche une opération pour le détail" />
      {items.length === 0 ? (
        <EmptyState emoji="🧾" title="Aucune opération" className="py-4">
          Ajoute ta première dépense avec le bouton « Ajouter ».
        </EmptyState>
      ) : (
        <ul className="-mx-3 -my-1">
          {items.map((t) => {
            const category = categoryOf(t.categoryId);
            return (
              <TransactionRow
                key={t.id}
                label={t.label}
                category={category}
                subtitle={`${category.label} · ${formatDayHeading(t.date, data.today)}`}
                amount={signedAmount(t)}
                recurring={t.recurrence !== undefined && t.recurrence !== "none"}
                highlighted={t.id === highlightId}
                onClick={() => openTransaction(t)}
              />
            );
          })}
        </ul>
      )}
      <Link href="/transactions" className={buttonStyles({ variant: "soft", size: "md" }) + " mt-4 w-full"}>
        Voir toutes les transactions
        <ArrowRight size={17} aria-hidden />
      </Link>
    </Card>
  );
}
