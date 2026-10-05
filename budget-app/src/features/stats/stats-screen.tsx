"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatMonth } from "@/lib/dates";
import { useBudget } from "@/store/budget-store";
import { BalanceView } from "./balance-view";
import { MonthView } from "./month-view";
import { TrendsView } from "./trends-view";

type View = "month" | "balance" | "trends";

/** Trois vues simples plutôt qu'un tableau de bord chargé. */
export function StatsScreen() {
  const { today } = useBudget();
  const [view, setView] = useState<View>("month");

  return (
    <>
      <PageHeader title="Statistiques" subtitle={formatMonth(today)} />

      <SegmentedControl
        label="Vue"
        value={view}
        onChange={setView}
        options={[
          { value: "month", label: "Ce mois-ci" },
          { value: "balance", label: "Solde" },
          { value: "trends", label: "Tendances" },
        ]}
        className="mb-5 w-full animate-rise sm:w-auto"
      />

      {view === "month" && <MonthView />}
      {view === "balance" && <BalanceView />}
      {view === "trends" && <TrendsView />}
    </>
  );
}
