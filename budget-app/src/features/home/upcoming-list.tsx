"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { monthUpcoming } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatRelativeFuture, getMonthDay } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";

/** Combien d'opérations à venir sont montrées sur l'accueil (le reste : « Dépenses et revenus »). */
const SHOWN = 4;

/** « Prochainement » : les prochains prélèvements, revenus et dépenses prévues du mois, déjà comptés. */
export function UpcomingList() {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const all = monthUpcoming(data, data.currentMonth);
  const items = all.slice(0, SHOWN);
  const hidden = all.length - items.length;
  const signed = (kind: string, amount: number) => (kind === "income" ? amount : -amount);

  return (
    <Card>
      <SectionHeader title="Prochainement" subtitle="Déjà comptés dans ton budget du mois" />
      {items.length === 0 ? (
        <EmptyState emoji="🌙" title="Plus rien de prévu" className="py-4">
          Aucun prélèvement ni dépense prévue d&apos;ici la fin du mois.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const category = categoryOf(item.categoryId);
            const { day, month } = getMonthDay(item.date);
            return (
              <li key={item.id} className="flex items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "grid size-11 shrink-0 place-content-center rounded-2xl text-center leading-none",
                    item.kind === "income" ? "bg-sage-50" : item.kind === "saving" ? "bg-lilac-50" : "bg-peach-50",
                  )}
                >
                  <span className="text-base font-semibold">{day}</span>
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
      {hidden > 0 && (
        <Link
          href="/transactions"
          className="-mx-3 mt-3 inline-flex min-h-11 items-center gap-0.5 rounded-full px-3 text-sm font-semibold text-blush-700 transition-colors hover:bg-blush-50"
        >
          {hidden === 1 ? "1 autre opération à venir" : `${hidden} autres opérations à venir`}
          <ChevronRight size={16} aria-hidden />
        </Link>
      )}
    </Card>
  );
}
