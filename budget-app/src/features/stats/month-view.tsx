"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { ComparisonBars } from "@/components/charts/comparison-bars";
import { RankedBars } from "@/components/charts/ranked-bars";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { compareWithPreviousMonth, getSpendingByCategory, total } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatLongDate, formatMonthName } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { getDailySpending } from "@/lib/timeline";
import { useBudget } from "@/store/budget-store";

export function MonthView() {
  const data = useBudget();
  const { summary, currentMonth } = data;
  const comparison = useMemo(() => compareWithPreviousMonth(data), [data]);
  const daily = useMemo(() => getDailySpending(data, currentMonth), [data, currentMonth]);
  const spending = getSpendingByCategory(data, currentMonth);
  const spentSoFar = total(daily.map((d) => d.amount));
  const dailyBudget = summary.variableBudget / summary.daysInMonth;

  const previousName = comparison ? formatMonthName(comparison.previousMonth).toLowerCase() : "";
  const deltaPercent = comparison ? Math.round(Math.abs(comparison.delta) * 100) : 0;
  const better = comparison ? comparison.delta <= 0 : true;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start">
      {comparison && (
        <div className={cn("flex animate-rise items-start gap-4 rounded-card p-5 lg:col-span-2", better ? "bg-sage-50" : "bg-peach-50")}>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface/85">
            {better ? <TrendingDown size={20} className="text-sage-700" aria-hidden /> : <TrendingUp size={20} className="text-peach-700" aria-hidden />}
          </span>
          <div>
            <p className="text-[17px] font-semibold leading-snug">
              {deltaPercent === 0
                ? "Tu dépenses au même rythme que le mois dernier."
                : `Tu as dépensé ${deltaPercent} % de ${better ? "moins" : "plus"} que le mois dernier.`}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Dépenses du quotidien du 1er au {comparison.day} : <Money value={comparison.current} /> contre <Money value={comparison.previous} /> en{" "}
              {previousName}.
            </p>
          </div>
        </div>
      )}

      <Card className="animate-rise [animation-delay:50ms] lg:col-span-2">
        <SectionHeader
          title="Dépenses du mois"
          subtitle={
            <>
              Au quotidien, jour par jour · <Money value={spentSoFar} /> dépensés sur <Money value={summary.variableBudget} /> prévus
            </>
          }
        />
        <ColumnChart
          title="Dépenses du quotidien, jour par jour"
          data={daily.map((d) => ({
            key: d.date,
            label: String(d.day),
            longLabel: formatLongDate(d.date),
            value: d.amount,
            planned: d.planned,
          }))}
          labelEvery={7}
          reference={{ value: dailyBudget, label: "Budget moyen par jour" }}
          defaultKey={data.today}
          readout
          height={220}
        />
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-[3px] bg-peach-600" /> Dépensé
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-[3px] bg-peach-300" /> Prévu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 bg-ink/40" /> Budget moyen par jour ({formatMoney(dailyBudget, { cents: "always" })})
          </span>
        </p>
      </Card>

      <Card className="animate-rise [animation-delay:100ms]">
        <SectionHeader
          title="Répartition des dépenses"
          subtitle={
            <>
              <Money value={summary.committed} /> engagés ce mois-ci
            </>
          }
        />
        <RankedBars
          title="Dépenses par catégorie"
          items={spending.map(({ category, amount }) => ({ id: category.id, emoji: category.emoji, label: category.label, value: amount }))}
        />
      </Card>

      {comparison && (
        <Card className="animate-rise [animation-delay:150ms]">
          <SectionHeader title={`Comparaison avec ${previousName}`} subtitle={`Au quotidien, du 1er au ${comparison.day} du mois`} />
          <ComparisonBars
            items={comparison.byCategory.slice(0, 5).map(({ category, current, previous }) => ({
              id: category.id,
              emoji: category.emoji,
              label: category.label,
              current,
              previous,
            }))}
            currentLabel={formatMonthName(currentMonth)}
            previousLabel={formatMonthName(comparison.previousMonth)}
          />
        </Card>
      )}
    </div>
  );
}
