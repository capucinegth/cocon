"use client";

import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { getCategory } from "@/config/categories";
import { getSpendingByCategory } from "@/lib/budget";
import { formatMoney } from "@/lib/format";
import { useBudget } from "@/store/budget-store";

/** « Tes dépenses » : les principales catégories du mois face à leur budget. */
export function SpendingOverview({ limit = 5 }: { limit?: number }) {
  const data = useBudget();
  const items = getSpendingByCategory(data).slice(0, limit);

  return (
    <Card className="h-full">
      <SectionHeader title="Tes dépenses" subtitle="Ce mois-ci, par catégorie" href="/budget" linkLabel="Budget" />
      <ul className="flex flex-col gap-5">
        {items.map(({ categoryId, amount }) => {
          const category = getCategory(categoryId);
          const planned = data.plan.planned[categoryId] ?? 0;
          return (
            <li key={categoryId}>
              <div className="flex items-center gap-3">
                <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{category.label}</span>
                <span className="tabular text-[15px] font-semibold">{formatMoney(amount)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 pl-12">
                <ProgressBar
                  value={planned > 0 ? amount / planned : 0}
                  tone={category.tone}
                  size="sm"
                  label={`${category.label} : ${formatMoney(amount)} sur ${formatMoney(planned)}`}
                />
                <span className="w-[4.75rem] shrink-0 text-right text-[13px] text-muted">
                  sur {formatMoney(planned)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
