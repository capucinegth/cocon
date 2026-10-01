"use client";

import { PageHeader } from "@/components/layout/page-header";
import { formatMonth } from "@/lib/dates";
import { useBudget } from "@/store/budget-store";
import { AvailableHero } from "./available-hero";
import { GoalTeaser } from "./goal-teaser";
import { SpendingOverview } from "./spending-overview";
import { SummaryCards } from "./summary-cards";
import { UpcomingList } from "./upcoming-list";

export function HomeScreen() {
  const { today } = useBudget();

  return (
    <>
      <PageHeader title="Bonjour 👋" subtitle={formatMonth(today)} />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        <div className="animate-rise lg:col-span-7">
          <AvailableHero />
        </div>
        <div className="animate-rise [animation-delay:60ms] lg:col-span-5">
          <SummaryCards />
        </div>
        <div className="animate-rise [animation-delay:120ms] lg:col-span-7">
          <SpendingOverview />
        </div>
        <div className="flex animate-rise flex-col gap-4 [animation-delay:180ms] sm:gap-5 lg:col-span-5">
          <UpcomingList />
          <GoalTeaser />
        </div>
      </div>
    </>
  );
}
