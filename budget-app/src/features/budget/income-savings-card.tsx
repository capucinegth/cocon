"use client";

import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { allocateSavings, monthTransactions, type MonthSummary } from "@/lib/budget";
import { formatShortDate } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";

/** Ce qui est entré ce mois-ci, et comment l'épargne a été répartie entre les objectifs. */
export function IncomeSavingsCard({ summary }: { summary: MonthSummary }) {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const incomes = monthTransactions(data, summary.month).filter((t) => t.kind === "income");
  const savings = allocateSavings(data.goals, summary.saved);

  return (
    <Card>
      <SectionHeader title="Revenus et épargne" subtitle="Reçu et mis de côté ce mois-ci" />
      <ul className="flex flex-col gap-3">
        {incomes.map((income) => {
          const category = categoryOf(income.categoryId);
          return (
            <li key={income.id} className="flex items-center gap-3">
              <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold">{income.label}</span>
                <span className="block text-[13px] text-muted">Reçu le {formatShortDate(income.date)}</span>
              </span>
              <Money value={income.amount} sign="always" className="tabular text-[15px] font-semibold text-sage-700" />
            </li>
          );
        })}
      </ul>

      <div className="my-4 h-px bg-line" />

      <ul className="flex flex-col gap-3">
        {savings.map(({ goal, done }) => (
          <li key={goal.id} className="flex items-center gap-3">
            <CategoryBadge emoji={goal.emoji} tone={goal.tone} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-semibold">{goal.label}</span>
              <span className="block text-[13px] text-muted">
                <Money value={goal.monthlyContribution} /> prévus chaque mois
              </span>
            </span>
            {done >= goal.monthlyContribution && goal.monthlyContribution > 0 ? (
              <StatusPill status="done">Versé</StatusPill>
            ) : (
              <StatusPill status="scheduled">À verser</StatusPill>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
