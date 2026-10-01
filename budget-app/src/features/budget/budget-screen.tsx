"use client";

import { Banknote, House, Sprout, ShoppingBasket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { categoryGroups, getCategory } from "@/config/categories";
import { allocateSavings, getGroupUsage } from "@/lib/budget";
import { formatMonth } from "@/lib/dates";
import { roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { BudgetGroupCard } from "./budget-group-card";
import { BudgetLine } from "./budget-line";
import { RemainingCard } from "./remaining-card";

export function BudgetScreen() {
  const data = useBudget();
  const { summary, goals } = data;

  const income = getGroupUsage("revenus", data);
  const fixed = getGroupUsage("fixes", data);
  const variable = getGroupUsage("variables", data);

  const savingLines = allocateSavings(goals, summary.saved);
  const savingPlanned = goals.reduce((acc, goal) => acc + goal.monthlyContribution, 0);

  return (
    <>
      <PageHeader title="Budget" subtitle={formatMonth(data.today)} />

      {/* Mobile : une colonne dans l'ordre logique. Desktop : deux colonnes équilibrées. */}
      <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4 sm:gap-5 max-lg:contents">
          <BudgetGroupCard
            className="order-1 animate-rise"
            title={categoryGroups.revenus.label}
            description={categoryGroups.revenus.description}
            icon={Banknote}
            tone="blush"
            amount={income.done}
            planned={income.planned}
          >
            {income.lines.map((line) => {
              const category = getCategory(line.categoryId);
              return (
                <BudgetLine
                  key={line.categoryId}
                  mode="income"
                  label={category.label}
                  emoji={category.emoji}
                  tone={category.tone}
                  planned={line.planned}
                  done={line.done}
                />
              );
            })}
          </BudgetGroupCard>

          <BudgetGroupCard
            className="order-2 animate-rise [animation-delay:60ms]"
            title={categoryGroups.fixes.label}
            description={categoryGroups.fixes.description}
            icon={House}
            tone="lilac"
            amount={roundCents(fixed.done + fixed.upcoming)}
            planned={fixed.planned}
          >
            {fixed.lines.map((line) => {
              const category = getCategory(line.categoryId);
              return (
                <BudgetLine
                  key={line.categoryId}
                  mode="fixed"
                  label={category.label}
                  emoji={category.emoji}
                  tone={category.tone}
                  planned={line.planned}
                  done={line.done}
                  upcoming={line.upcoming}
                  nextDate={line.nextUpcomingDate}
                />
              );
            })}
          </BudgetGroupCard>

          <BudgetGroupCard
            className="order-4 animate-rise [animation-delay:180ms]"
            title={categoryGroups.epargne.label}
            description={categoryGroups.epargne.description}
            icon={Sprout}
            tone="sage"
            amount={summary.saved}
            planned={savingPlanned}
          >
            {savingLines.map(({ goal, done }) => (
              <BudgetLine
                key={goal.id}
                mode="saving"
                label={goal.label}
                emoji={goal.emoji}
                tone="sage"
                planned={goal.monthlyContribution}
                done={done}
              />
            ))}
          </BudgetGroupCard>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5 max-lg:contents">
          <BudgetGroupCard
            className="order-3 animate-rise [animation-delay:120ms]"
            title={categoryGroups.variables.label}
            description={categoryGroups.variables.description}
            icon={ShoppingBasket}
            tone="peach"
            amount={roundCents(variable.done + variable.upcoming)}
            planned={variable.planned}
          >
            {variable.lines.map((line) => {
              const category = getCategory(line.categoryId);
              return (
                <BudgetLine
                  key={line.categoryId}
                  mode="expense"
                  label={category.label}
                  emoji={category.emoji}
                  tone={category.tone}
                  planned={line.planned}
                  done={line.done}
                  upcoming={line.upcoming}
                  nextDate={line.nextUpcomingDate}
                />
              );
            })}
          </BudgetGroupCard>

          <div className="order-5 animate-rise [animation-delay:240ms]">
            <RemainingCard
              income={summary.income}
              fixed={roundCents(fixed.done + fixed.upcoming)}
              variable={roundCents(variable.done + variable.upcoming)}
              saved={summary.saved}
              remaining={summary.remaining}
              perDay={summary.perDay}
              daysLeft={summary.daysLeft}
            />
          </div>
        </div>
      </div>
    </>
  );
}
