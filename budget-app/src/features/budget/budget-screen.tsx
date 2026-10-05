"use client";

import { Banknote, Plus, ReceiptText, Sprout, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { RemainingBreakdown } from "@/components/finance/remaining-breakdown";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { availableMonths, getExpenseUsages, getMonthSummary, planFor, total } from "@/lib/budget";
import { addMonths, formatMonth, formatMonthName } from "@/lib/dates";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import { BudgetSplitCard } from "./budget-split-card";
import { CategoryBudgetRow } from "./category-budget-row";
import { IncomeSavingsCard } from "./income-savings-card";
import { RecurringCard } from "./recurring-card";

export function BudgetScreen() {
  const data = useBudget();
  const { currentMonth } = data;
  const { openCategorySheet, openCategoryEdit } = useUI();
  const [month, setMonth] = useState(currentMonth);
  // Mois consultables + le mois prochain, pour préparer son budget à l'avance.
  const months = useMemo(() => [...new Set([...availableMonths(data), addMonths(currentMonth, 1)])].sort(), [data, currentMonth]);
  const summary = useMemo(() => getMonthSummary(data, month), [data, month]);
  const usages = useMemo(() => getExpenseUsages(data, month), [data, month]);
  const plan = planFor(data, month);
  const plannedTotal = total(usages.map((u) => u.planned));
  const monthName = formatMonthName(month).toLowerCase();
  const elided = /^[aeiouyéè]/i.test(monthName) ? `d'${monthName}` : `de ${monthName}`;
  const incomeToCome = summary.incomeUpcoming + summary.incomeExpected;

  return (
    <>
      <PageHeader
        title={`Budget ${elided}`}
        subtitle="Ce qui est prévu, dépensé et encore disponible"
        actions={
          <div className="hidden sm:block">
            <Button variant="soft" onClick={openCategorySheet}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Catégorie
            </Button>
          </div>
        }
      >
        <MonthSwitcher month={month} months={months} onChange={setMonth} />
      </PageHeader>

      {plan?.inherited && !summary.isPast && (
        <p className="mb-4 animate-rise rounded-2xl bg-lilac-50 px-4 py-3 text-[14px] text-ink-soft">
          Budget repris de {formatMonth(data.plans.filter((p) => p.month < month).at(-1)?.month ?? month).toLowerCase()} : touche une catégorie pour l&apos;ajuster.
        </p>
      )}

      <div className="grid animate-rise grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          tone="blush"
          icon={Banknote}
          label="Revenus"
          value={<Money value={summary.income} />}
          caption={
            incomeToCome > 0 ? (
              <>
                dont <Money value={incomeToCome} /> attendus
              </>
            ) : summary.isPast ? (
              "Reçus ce mois-là"
            ) : (
              "Reçus ce mois-ci"
            )
          }
        />
        <StatCard
          tone="peach"
          icon={ReceiptText}
          label="Dépenses prévues"
          value={<Money value={summary.committed} />}
          caption="Payées ou à venir"
        />
        <StatCard tone="sage" icon={Sprout} label="Épargne" value={<Money value={summary.savingsReserved} />} caption="Pour tes objectifs" />
        <StatCard
          tone="lilac"
          icon={Wallet}
          label="Disponible"
          value={<Money value={summary.remaining} cents="always" />}
          caption={
            <>
              ≈ <Money value={summary.perDay} cents="always" /> / jour
            </>
          }
          className="bg-linear-to-br from-blush-100 to-lilac-50"
        />
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:mt-5 sm:gap-5 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:col-span-7">
          <div className="order-1 animate-rise [animation-delay:50ms]">
            <BudgetSplitCard summary={summary} />
          </div>
          <Card className="order-2 animate-rise [animation-delay:100ms]">
            <SectionHeader
              title="Tes catégories"
              subtitle={
                <>
                  <Money value={summary.committed} /> sur <Money value={plannedTotal} /> prévus
                </>
              }
              aside={
                <Button variant="accent" size="sm" onClick={openCategorySheet} className="-mr-2" aria-label="Ajouter une catégorie">
                  <Plus size={17} strokeWidth={2.4} aria-hidden />
                  Ajouter
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {usages.map((usage) => (
                <CategoryBudgetRow key={usage.category.id} usage={usage} onEdit={() => openCategoryEdit(usage.category.id, month)} />
              ))}
            </ul>
            {plannedTotal === 0 && usages.length > 0 && (
              <p className="mt-3 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
                Touche une catégorie pour lui donner un budget : Cocon calculera ensuite ce qu&apos;il te reste chaque jour.
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:sticky xl:top-6 xl:col-span-5">
          <div className="order-3 animate-rise [animation-delay:150ms]">
            <RemainingBreakdown summary={summary} />
          </div>
          <div className="order-4 animate-rise [animation-delay:200ms]">
            <IncomeSavingsCard summary={summary} />
          </div>
          <div className="order-5 animate-rise [animation-delay:250ms]">
            <RecurringCard />
          </div>
        </div>
      </div>
    </>
  );
}
