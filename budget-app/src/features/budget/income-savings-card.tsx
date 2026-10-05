"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { allocateSavings, goalContributions, monthTransactions, monthUpcoming, planFor, type MonthSummary } from "@/lib/budget";
import { formatShortDate } from "@/lib/dates";
import { roundCents } from "@/lib/format";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/** Ce qui entre ce mois-ci (reçu, prévu, attendu) et comment l'épargne est répartie entre les objectifs. */
export function IncomeSavingsCard({ summary }: { summary: MonthSummary }) {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const { openTargets } = useUI();
  const incomes = monthTransactions(data, summary.month).filter((t) => t.kind === "income");
  const incomingSoon = summary.isPast ? [] : monthUpcoming(data, summary.month).filter((u) => u.kind === "income");
  const plan = planFor(data, summary.month);
  const direct = goalContributions(data, summary.month);
  const unassigned = roundCents(summary.saved - [...direct.values()].reduce((acc, value) => acc + value, 0));
  const savings = allocateSavings(data.goals, Math.max(unassigned, 0)).map(({ goal, done }) => ({
    goal,
    done: roundCents(done + (direct.get(goal.id) ?? 0)),
  }));
  const nothing = incomes.length === 0 && incomingSoon.length === 0 && summary.incomeExpected === 0;

  return (
    <Card>
      <SectionHeader
        title="Revenus et épargne"
        subtitle={summary.isPast ? "Reçu et mis de côté ce mois-là" : "Reçu, attendu et mis de côté"}
        aside={
          <Button variant="accent" size="sm" onClick={() => openTargets(summary.month)} className="-mr-2" aria-label="Modifier les revenus et l'épargne prévus">
            <Pencil size={15} aria-hidden />
            Modifier
          </Button>
        }
      />
      <ul className="flex flex-col gap-3">
        {incomes.map((income) => {
          const category = categoryOf(income.categoryId);
          return (
            <li key={income.id} className="flex items-center gap-3">
              <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold">{income.label}</span>
                <span className="block text-[13px] text-muted">Reçu le {formatShortDate(income.date)}</span>
              </span>
              <Money value={income.amount} sign="always" className="tabular text-[15px] font-semibold text-sage-700" />
            </li>
          );
        })}
        {incomingSoon.map((income) => {
          const category = categoryOf(income.categoryId);
          return (
            <li key={income.id} className="flex items-center gap-3">
              <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold">{income.label}</span>
                <span className="block text-[13px] text-muted">Prévu le {formatShortDate(income.date)}</span>
              </span>
              <Money value={income.amount} sign="always" className="tabular text-[15px] font-semibold text-muted" />
            </li>
          );
        })}
        {summary.incomeExpected > 0 && (
          <li className="flex items-center gap-3">
            <CategoryBadge emoji="⏳" tone="sage" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[15px] font-semibold">Revenus attendus</span>
              <span className="block text-[13px] text-muted">
                Selon ton budget (<Money value={plan?.incomeTarget ?? 0} /> prévus)
              </span>
            </span>
            <Money value={summary.incomeExpected} sign="always" className="tabular text-[15px] font-semibold text-muted" />
          </li>
        )}
        {nothing && (
          <li className="rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
            Aucun revenu pour l&apos;instant. Ajoute-le comme opération, ou indique tes revenus prévus avec « Modifier ».
          </li>
        )}
      </ul>

      <div className="my-4 h-px bg-line" />

      {plan && plan.savingsTarget > 0 && (
        <p className="mb-3 text-[13px] text-muted">
          Épargne prévue : <Money value={plan.savingsTarget} /> · versée : <Money value={summary.saved} />
        </p>
      )}
      {savings.length === 0 ? (
        <p className="rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">Crée un objectif d&apos;épargne pour suivre où va ton argent mis de côté.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {savings.map(({ goal, done }) => (
            <li key={goal.id} className="flex items-center gap-3">
              <CategoryBadge emoji={goal.emoji} tone={goal.tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-semibold">{goal.label}</span>
                <span className="block text-[13px] text-muted">
                  <Money value={goal.monthlyContribution} /> prévus chaque mois
                </span>
              </span>
              {done >= goal.monthlyContribution && goal.monthlyContribution > 0 ? (
                <StatusPill status="done">Versé</StatusPill>
              ) : done > 0 ? (
                <StatusPill status="scheduled">
                  <Money value={done} /> versés
                </StatusPill>
              ) : (
                <StatusPill status="scheduled">À verser</StatusPill>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
