"use client";

import { useState } from "react";
import { DonutChart, type DonutSegment } from "@/components/charts/donut-chart";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import type { MonthSummary } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

/**
 * Répartition des revenus du mois. Ordre validé pour le daltonisme :
 * sauge · lilas · terracotta (jamais terracotta contre sauge) ; le reste du rail = disponible.
 */
export function BudgetSplitCard({ summary }: { summary: MonthSummary }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const segments: (DonutSegment & { swatch: string; hint: string })[] = [
    { id: "epargne", label: "Épargne", value: summary.savingsReserved, strokeClass: "stroke-sage-500", swatch: "bg-sage-500", hint: "Mise de côté" },
    { id: "fixes", label: "Charges fixes", value: summary.fixed, strokeClass: "stroke-lilac-500", swatch: "bg-lilac-500", hint: "Loyer, factures" },
    { id: "quotidien", label: "Dépenses du quotidien", value: summary.variable, strokeClass: "stroke-peach-600", swatch: "bg-peach-600", hint: "Dépensé + prévu" },
  ];
  const legend = [
    ...segments,
    { id: "disponible", label: "Disponible", value: Math.max(summary.remaining, 0), swatch: "bg-blush-100 ring-1 ring-blush-300", hint: "Encore libre" },
  ];
  const active = legend.find((item) => item.id === activeId);
  const share = (value: number) => (summary.income > 0 ? formatPercent(value / summary.income) : "—");

  return (
    <Card>
      <SectionHeader title="Où va ton argent" subtitle={<>Répartition de tes <Money value={summary.income} /> de revenus</>} />
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <DonutChart
          title="Répartition des revenus du mois"
          segments={segments}
          total={summary.income}
          trackClass="stroke-blush-100"
          activeId={activeId}
          onActiveChange={setActiveId}
          size={208}
        >
          <div className="max-w-[8.5rem]">
            <p className="text-[13px] font-medium text-muted">{active?.label ?? "Disponible"}</p>
            <Money value={active?.value ?? summary.remaining} cents="always" className="text-[22px] font-semibold tracking-tight" />
            <p className="text-[13px] text-muted">{share(active?.value ?? summary.remaining)} des revenus</p>
          </div>
        </DonutChart>

        <ul className="flex w-full flex-col gap-1">
          {legend.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => item.id !== "disponible" && setActiveId(item.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => item.id !== "disponible" && setActiveId(item.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setActiveId(activeId === item.id || item.id === "disponible" ? null : item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-canvas",
                  activeId === item.id && "bg-canvas",
                )}
              >
                <span aria-hidden className={cn("size-3 shrink-0 rounded-[4px]", item.swatch)} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-medium">{item.label}</span>
                  <span className="block text-[13px] text-muted">{item.hint}</span>
                </span>
                <span className="text-right">
                  <Money value={item.value} className="tabular block text-[15px] font-semibold" />
                  <span className="tabular block text-[13px] text-muted">{share(item.value)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
