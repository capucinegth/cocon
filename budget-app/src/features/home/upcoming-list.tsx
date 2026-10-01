"use client";

import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { getCategory } from "@/config/categories";
import { upcomingOfMonth } from "@/lib/budget";
import { formatRelativeFuture, getMonthDay } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { useBudget } from "@/store/budget-store";

/** « À venir » : les prochains prélèvements prévus, pour anticiper. */
export function UpcomingList() {
  const data = useBudget();
  const items = upcomingOfMonth(data);

  return (
    <Card>
      <SectionHeader
        title="À venir"
        subtitle="Prélèvements prévus ce mois-ci"
        aside={<span className="tabular text-[15px] font-semibold">{formatMoney(-data.summary.upcoming)}</span>}
      />
      {items.length === 0 ? (
        <p className="text-[15px] text-muted">Rien de prévu d&apos;ici la fin du mois ✨</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const category = getCategory(item.categoryId);
            const { day, month } = getMonthDay(item.date);
            return (
              <li key={item.id} className="flex items-center gap-4">
                <div className="grid size-12 shrink-0 place-content-center rounded-2xl bg-peach-50 text-center leading-none">
                  <span className="text-[17px] font-semibold">{day}</span>
                  <span className="mt-0.5 text-[11px] font-semibold text-peach-700">{month}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{item.label}</p>
                  <p className="truncate text-[13px] text-muted">
                    {category.emoji} {category.label} · {formatRelativeFuture(item.date, data.today)}
                  </p>
                </div>
                <span className="tabular text-[15px] font-semibold">{formatMoney(-item.amount)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
