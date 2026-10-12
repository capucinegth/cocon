"use client";

import { useMemo } from "react";
import { AreaChart } from "@/components/charts/area-chart";
import { ColumnChart } from "@/components/charts/column-chart";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { formatMonth, formatMonthShort } from "@/lib/dates";
import { averagedMonthsCount, averageMonthlyExpenses, getMonthlyHistory } from "@/lib/timeline";
import { useBudget } from "@/store/budget-store";

/** Les six derniers mois (depuis le début de l'utilisation) : dépenses et épargne cumulée. */
export function TrendsView() {
  const data = useBudget();
  const history = useMemo(() => getMonthlyHistory(data), [data]);
  const average = averageMonthlyExpenses(history);
  const averaged = averagedMonthsCount(history);
  const savingsGrowth = history.at(-1)!.savingsTotal - history[0].savingsTotal;

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
      <Card className="animate-rise">
        <SectionHeader
          title="Évolution des dépenses"
          subtitle={
            averaged > 0 ? (
              <>
                Moyenne : <Money value={Math.round(average)} /> / mois · sur {averaged} mois terminé{averaged > 1 ? "s" : ""}
              </>
            ) : (
              "La moyenne apparaîtra après ton premier mois complet."
            )
          }
        />
        <ColumnChart
          title="Dépenses des derniers mois"
          data={history.map((point) => ({
            key: point.month,
            label: formatMonthShort(point.month),
            longLabel: formatMonth(point.month),
            value: point.expenses,
            partial: point.partial,
          }))}
        />
      </Card>

      <Card className="animate-rise [animation-delay:60ms]">
        <SectionHeader
          title="Évolution de l'épargne"
          subtitle={
            <>
              <Money value={savingsGrowth} sign="always" /> en {history.length} mois
            </>
          }
        />
        <AreaChart
          title="Épargne totale cumulée"
          data={history.map((point) => ({
            key: point.month,
            label: formatMonthShort(point.month),
            longLabel: formatMonth(point.month),
            value: point.savingsTotal,
          }))}
        />
      </Card>
    </div>
  );
}
