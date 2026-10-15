"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { availableMonths } from "@/lib/budget";
import { formatMonth } from "@/lib/dates";
import { useBudget } from "@/store/budget-store";
import { BalanceView } from "./balance-view";
import { MonthView } from "./month-view";
import { TrendsView } from "./trends-view";

type View = "month" | "balance" | "trends";

/** Trois vues simples plutôt qu'un tableau de bord chargé. */
export function StatsScreen() {
  const data = useBudget();
  const [view, setView] = useState<View>("month");
  const [month, setMonth] = useState(data.currentMonth);
  const months = useMemo(() => availableMonths(data), [data]);

  return (
    <>
      <PageHeader title="Statistiques" subtitle={formatMonth(view === "month" ? month : data.today)}>
        {view === "month" && months.length > 1 && <MonthSwitcher month={month} months={months} onChange={setMonth} />}
      </PageHeader>

      <SegmentedControl
        label="Vue"
        value={view}
        onChange={setView}
        options={[
          { value: "month", label: "Mois" },
          { value: "balance", label: "Solde" },
          { value: "trends", label: "Tendances" },
        ]}
        className="mb-5 w-full animate-rise sm:w-auto"
      />

      {/* Changer de mois recalcule tout (et réinitialise la sélection des graphiques). */}
      {view === "month" && <MonthView key={month} month={month} />}
      {view === "balance" && <BalanceView />}
      {view === "trends" && <TrendsView />}
    </>
  );
}
