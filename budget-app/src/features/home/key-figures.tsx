import { Banknote, House, Sprout } from "lucide-react";
import { Money } from "@/components/ui/money";
import { StatCard } from "@/components/ui/stat-card";
import type { MonthSummary } from "@/lib/budget";

/** Trois repères du mois : revenus (rose), charges fixes (lilas), épargne (sauge). */
export function KeyFigures({ summary }: { summary: MonthSummary }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
      <StatCard size="compact" tone="blush" icon={Banknote} label="Revenus" value={<Money value={summary.income} />} />
      <StatCard size="compact" tone="lilac" icon={House} label="Charges fixes" value={<Money value={summary.fixed} />} />
      <StatCard
        size="compact"
        tone="sage"
        icon={Sprout}
        label={summary.isPast ? "Épargne" : "Épargne prévue"}
        value={<Money value={summary.savingsReserved} />}
      />
    </div>
  );
}
