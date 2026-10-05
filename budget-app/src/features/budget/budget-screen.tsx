"use client";

import { Banknote, Plus, ReceiptText, Sprout, Wallet } from "lucide-react";
import { useMemo } from "react";
import { RemainingBreakdown } from "@/components/finance/remaining-breakdown";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { getExpenseUsages, total } from "@/lib/budget";
import { formatMonthName } from "@/lib/dates";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import { BudgetSplitCard } from "./budget-split-card";
import { CategoryBudgetRow } from "./category-budget-row";
import { IncomeSavingsCard } from "./income-savings-card";

export function BudgetScreen() {
  const data = useBudget();
  const { summary, currentMonth } = data;
  const { openCategorySheet } = useUI();
  const usages = useMemo(() => getExpenseUsages(data, currentMonth), [data, currentMonth]);
  const plannedTotal = total(usages.map((u) => u.planned));
  const monthName = formatMonthName(currentMonth).toLowerCase();

  return (
    <>
      <PageHeader
        title={`Budget de ${monthName}`}
        subtitle="Ce qui est prévu, dépensé et encore disponible"
        actions={
          <div className="hidden sm:block">
            <Button variant="soft" onClick={openCategorySheet}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Catégorie
            </Button>
          </div>
        }
      />

      <div className="grid animate-rise grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard tone="blush" icon={Banknote} label="Revenus" value={<Money value={summary.income} />} caption="Reçus ce mois-ci" />
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
                <Button variant="accent" size="sm" onClick={openCategorySheet} className="-mr-2">
                  <Plus size={17} strokeWidth={2.4} aria-hidden />
                  Ajouter
                </Button>
              }
            />
            <ul className="divide-y divide-line">
              {usages.map((usage) => (
                <CategoryBudgetRow key={usage.category.id} usage={usage} />
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:sticky xl:top-6 xl:col-span-5">
          <div className="order-3 animate-rise [animation-delay:150ms]">
            <RemainingBreakdown summary={summary} />
          </div>
          <div className="order-4 animate-rise [animation-delay:200ms]">
            <IncomeSavingsCard summary={summary} />
          </div>
        </div>
      </div>
    </>
  );
}
