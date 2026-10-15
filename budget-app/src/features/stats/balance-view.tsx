"use client";

import { useMemo } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { isLiquidAccount } from "@/config/accounts";
import { formatMonthName, formatShortDate } from "@/lib/dates";
import { getBalanceSeries } from "@/lib/timeline";
import { useBudget } from "@/store/budget-store";

/** Évolution du solde du compte sur le mois : réel jusqu'à aujourd'hui, prévision ensuite. */
export function BalanceView() {
  const data = useBudget();
  const { summary, currentMonth } = data;
  const series = useMemo(() => getBalanceSeries(data, currentMonth), [data, currentMonth]);
  const liquidNames = data.accounts
    .filter((a) => isLiquidAccount(a) && (a.isActive || a.initialBalance !== 0))
    .map((a) => a.label)
    .join(" · ");
  const todayIndex = summary.dayOfMonth - 1;
  const today = series[todayIndex];
  const end = series.at(-1)!;
  const lowest = series.reduce((low, point) => (point.balance < low.balance ? point : low), series[0]);
  const dateOf = (day: number) => `${currentMonth}-${String(day).padStart(2, "0")}`;

  const figures = [
    { label: "Aujourd'hui", value: today.balance, hint: formatShortDate(data.today) },
    { label: "Point le plus bas", value: lowest.balance, hint: `le ${formatShortDate(dateOf(lowest.day))}${lowest.projected ? " (prévu)" : ""}` },
    { label: `Fin ${formatMonthName(currentMonth).toLowerCase()}`, value: end.balance, hint: "si tu dépenses ton disponible" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5">
      <div className="grid animate-rise grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {figures.map((figure) => (
          <div key={figure.label} className="card flex items-center justify-between gap-3 px-5 py-4 sm:flex-col sm:items-start">
            <div>
              <p className="text-[13px] font-medium text-muted">{figure.label}</p>
              <p className="text-[13px] text-muted sm:hidden">{figure.hint}</p>
            </div>
            <Money value={figure.value} cents="always" className="text-xl font-semibold tracking-tight" />
            <p className="hidden text-[13px] text-muted sm:block">{figure.hint}</p>
          </div>
        ))}
      </div>

      <Card className="animate-rise [animation-delay:60ms]">
        <SectionHeader title="Solde total hors épargne" subtitle={`${liquidNames || "Tes comptes"}, jour par jour`} />
        <AreaChart
          title={`Solde total hors épargne en ${formatMonthName(currentMonth).toLowerCase()}`}
          data={series.map((point) => ({
            key: String(point.day),
            label: String(point.day),
            longLabel: formatShortDate(dateOf(point.day)),
            value: point.balance,
          }))}
          projectedFrom={todayIndex}
          labelEvery={7}
          height={260}
        />
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded bg-sage-500" /> Jusqu&apos;à aujourd&apos;hui
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded border-t-2 border-dashed border-sage-500/60" /> Prévision
          </span>
        </p>
        <p className="mt-3 rounded-2xl bg-canvas px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          Calculé à partir des soldes de départ de « Mes comptes » et des opérations saisies dans Cocon : ce n&apos;est pas un
          relevé bancaire. La prévision tient compte des opérations à venir et d&apos;un rythme de{" "}
          <Money value={summary.perDay} cents="always" /> par jour.
        </p>
      </Card>
    </div>
  );
}
