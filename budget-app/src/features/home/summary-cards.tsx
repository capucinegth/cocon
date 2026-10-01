"use client";

import { ReceiptText, Sprout, Wallet } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { formatMonthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { useBudget } from "@/store/budget-store";

/** Trois chiffres clés : budget (rose), dépenses (crème), épargne (sauge). */
export function SummaryCards() {
  const { summary, today } = useBudget();

  return (
    <div className="grid h-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
      <StatCard
        wide
        className="col-span-2 lg:col-span-1"
        tone="blush"
        icon={Wallet}
        label="Budget du mois"
        value={formatMoney(summary.income)}
        caption={`Tes revenus de ${formatMonthName(today).toLowerCase()}`}
      />
      <StatCard
        tone="peach"
        icon={ReceiptText}
        label="Dépenses"
        value={formatMoney(summary.committed)}
        caption={`dont ${formatMoney(summary.upcoming)} à venir`}
      />
      <StatCard
        tone="sage"
        icon={Sprout}
        label="Épargne"
        value={formatMoney(summary.saved)}
        caption="Mise de côté ce mois-ci"
      />
    </div>
  );
}
