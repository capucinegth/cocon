"use client";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { monthUpcoming, total, type MonthSummary } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatRelativeFuture, getMonthDay } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";

/** « À venir » : les prochains prélèvements et dépenses prévues, pour anticiper. */
export function UpcomingList({ summary }: { summary: MonthSummary }) {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const items = summary.isCurrent ? monthUpcoming(data, summary.month) : [];
  const signed = (kind: string, amount: number) => (kind === "income" ? amount : -amount);
  const net = total(items.map((item) => signed(item.kind, item.amount)));

  return (
    <Card>
      <SectionHeader
        title="À venir"
        subtitle={summary.isCurrent ? "Déjà déduit de ton disponible" : "Ce mois-ci est terminé"}
        aside={items.length ? <Money value={net} sign={net > 0 ? "always" : undefined} className="tabular text-[15px] font-semibold" /> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState emoji="🌙" title="Plus rien de prévu" className="py-4">
          {summary.isPast
            ? "Tous les mouvements de ce mois sont passés."
            : summary.isCurrent
              ? "Aucune dépense prévue d'ici la fin du mois."
              : "Les mouvements prévus apparaîtront ici."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const category = categoryOf(item.categoryId);
            const { day, month } = getMonthDay(item.date);
            return (
              <li key={item.id} className="flex items-center gap-4">
                <div
                  className={cn(
                    "grid size-12 shrink-0 place-content-center rounded-2xl text-center leading-none",
                    item.kind === "income" ? "bg-sage-50" : item.kind === "saving" ? "bg-lilac-50" : "bg-peach-50",
                  )}
                >
                  <span className="text-[17px] font-semibold">{day}</span>
                  <span
                    className={cn(
                      "mt-0.5 text-[11px] font-semibold",
                      item.kind === "income" ? "text-sage-700" : item.kind === "saving" ? "text-lilac-700" : "text-peach-700",
                    )}
                  >
                    {month}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15px] font-semibold">{item.label}</p>
                  <p className="break-words text-[13px] text-muted">
                    {category.emoji} {category.label} · {formatRelativeFuture(item.date, data.today)}
                  </p>
                </div>
                <Money
                  value={signed(item.kind, item.amount)}
                  sign={item.kind === "income" ? "always" : undefined}
                  className={cn("tabular text-[15px] font-semibold", item.kind === "income" && "text-sage-700")}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
