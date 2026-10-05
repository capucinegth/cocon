"use client";

import { useMemo, useState } from "react";
import { RemainingBreakdown } from "@/components/finance/remaining-breakdown";
import { PageHeader } from "@/components/layout/page-header";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { availableMonths, getMonthSummary } from "@/lib/budget";
import { useBudget } from "@/store/budget-store";
import { AvailableHero } from "./available-hero";
import { CalendarCard } from "./calendar-card";
import { GoalTeaser } from "./goal-teaser";
import { KeyFigures } from "./key-figures";
import { RecentTransactions } from "./recent-transactions";
import { UpcomingList } from "./upcoming-list";

/**
 * Accueil. Mobile : une colonne, dans l'ordre d'importance.
 * Desktop : deux colonnes (l'essentiel à gauche, l'anticipation à droite).
 */
export function HomeScreen() {
  const data = useBudget();
  const [month, setMonth] = useState(data.currentMonth);
  const months = useMemo(() => availableMonths(data), [data]);
  const summary = useMemo(() => getMonthSummary(data, month), [data, month]);

  return (
    <>
      <PageHeader title="Bonjour 👋">
        <MonthSwitcher month={month} months={months} onChange={setMonth} />
      </PageHeader>

      <div className="flex flex-col gap-4 sm:gap-5 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:col-span-7">
          <div className="order-1 animate-rise">
            <AvailableHero summary={summary} />
          </div>
          <div className="order-2 animate-rise [animation-delay:50ms]">
            <KeyFigures summary={summary} />
          </div>
          <div className="order-3 animate-rise [animation-delay:100ms]">
            <RemainingBreakdown summary={summary} />
          </div>
          <div className="order-5 animate-rise [animation-delay:150ms]">
            <RecentTransactions key={month} month={month} />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:col-span-5">
          <div className="order-4 animate-rise [animation-delay:120ms]">
            <UpcomingList summary={summary} />
          </div>
          <div className="order-6 animate-rise [animation-delay:180ms]">
            <CalendarCard key={month} month={month} />
          </div>
          <div className="order-7 animate-rise [animation-delay:220ms]">
            <GoalTeaser />
          </div>
        </div>
      </div>
    </>
  );
}
