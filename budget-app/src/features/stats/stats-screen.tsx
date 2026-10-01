"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { ColumnChart } from "@/components/charts/column-chart";
import { ComparisonBars } from "@/components/charts/comparison-bars";
import { RankedBars } from "@/components/charts/ranked-bars";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getCategory } from "@/config/categories";
import { getPaidByCategory, getSpendingByCategory } from "@/lib/budget";
import { addDays, dayOfMonth, formatMonth, formatMonthName, formatMonthShort, monthKey } from "@/lib/dates";
import { formatMoney, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import type { CategoryId } from "@/types/finance";

type View = "month" | "trends";

/** Catégories comparées d'un mois sur l'autre (les dépenses du quotidien). */
const comparedCategories: CategoryId[] = ["restaurants", "shopping", "courses", "transport"];

export function StatsScreen() {
  const data = useBudget();
  const [view, setView] = useState<View>("month");

  const currentMonth = monthKey(data.today);
  const previousMonthName = formatMonthName(addDays(`${currentMonth}-01`, -1)).toLowerCase();

  // Ce mois-ci
  const spending = getSpendingByCategory(data).map(({ categoryId, amount }) => {
    const category = getCategory(categoryId);
    return { id: categoryId, emoji: category.emoji, label: category.label, value: amount };
  });
  const paid = getPaidByCategory(data);
  const paidTotal = roundCents(Object.values(paid).reduce((acc, value) => acc + value, 0));
  const previousTotal = roundCents(Object.values(data.previousMonthToDate).reduce((acc, value) => acc + value, 0));
  const difference = roundCents(paidTotal - previousTotal);
  const comparison = comparedCategories.map((id) => {
    const category = getCategory(id);
    return { id, emoji: category.emoji, label: category.label, current: paid[id] ?? 0, previous: data.previousMonthToDate[id] ?? 0 };
  });

  // Tendances
  const history = data.history.map((point) =>
    point.month === currentMonth ? { ...point, expenses: data.summary.committed } : point,
  );
  const savingsGrowth = history.at(-1)!.savingsTotal - history[0].savingsTotal;
  const averageExpenses = roundCents(
    history.filter((p) => p.month !== currentMonth).reduce((acc, p) => acc + p.expenses, 0) / (history.length - 1),
  );

  return (
    <>
      <PageHeader title="Statistiques" subtitle={formatMonth(data.today)} />

      <SegmentedControl
        label="Période"
        value={view}
        onChange={setView}
        options={[
          { value: "month", label: "Ce mois-ci" },
          { value: "trends", label: "Tendances" },
        ]}
        className="mb-5 w-full animate-rise sm:w-auto"
      />

      {view === "month" ? (
        <div key="month" className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
          <div
            className={`flex animate-rise items-start gap-4 rounded-card p-5 lg:col-span-2 ${difference <= 0 ? "bg-sage-50" : "bg-peach-50"}`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface/80">
              {difference <= 0 ? (
                <TrendingDown size={20} className="text-sage-700" aria-hidden />
              ) : (
                <TrendingUp size={20} className="text-peach-700" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-[15px] font-semibold">
                {difference <= 0
                  ? `Tu as dépensé ${formatMoney(Math.round(-difference))} de moins qu'en ${previousMonthName}`
                  : `Tu as dépensé ${formatMoney(Math.round(difference))} de plus qu'en ${previousMonthName}`}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                À la même date ({dayOfMonth(data.today)} du mois).{" "}
                {difference <= 0 ? "Joli rythme, continue comme ça ✨" : "Rien de grave : les restaurants pèsent un peu plus."}
              </p>
            </div>
          </div>

          <Card className="animate-rise [animation-delay:60ms]">
            <SectionHeader title="Dépenses par catégorie" subtitle={`${formatMoney(data.summary.committed)} engagés ce mois-ci`} />
            <RankedBars items={spending} title="Dépenses par catégorie" />
          </Card>

          <Card className="animate-rise [animation-delay:120ms]">
            <SectionHeader title={`Comparaison avec ${previousMonthName}`} subtitle={`Du 1er au ${dayOfMonth(data.today)} du mois`} />
            <ComparisonBars
              items={comparison}
              currentLabel={formatMonthName(data.today)}
              previousLabel={formatMonthName(addDays(`${currentMonth}-01`, -1))}
            />
          </Card>
        </div>
      ) : (
        <div key="trends" className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <Card className="animate-rise">
            <SectionHeader
              title="Évolution des dépenses"
              subtitle={`Moyenne : ${formatMoney(Math.round(averageExpenses))} / mois`}
            />
            <ColumnChart
              title="Dépenses des six derniers mois"
              data={history.map((point) => ({
                key: point.month,
                label: formatMonthShort(point.month),
                value: point.expenses,
                partial: point.month === currentMonth,
              }))}
            />
          </Card>

          <Card className="animate-rise [animation-delay:60ms]">
            <SectionHeader
              title="Évolution de l'épargne"
              subtitle={`${formatMoney(savingsGrowth, { sign: "always" })} en ${history.length} mois`}
            />
            <AreaChart
              title="Épargne totale cumulée"
              data={history.map((point) => ({
                key: point.month,
                label: formatMonthShort(point.month),
                value: point.savingsTotal,
              }))}
            />
          </Card>
        </div>
      )}
    </>
  );
}
