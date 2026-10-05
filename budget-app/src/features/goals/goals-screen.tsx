"use client";

import { Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { total } from "@/lib/budget";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import { GoalCard } from "./goal-card";

export function GoalsScreen() {
  const { goals, summary, today } = useBudget();
  const { openGoalSheet, openAdd } = useUI();
  const totalSaved = total(goals.map((goal) => goal.saved));
  const totalTarget = total(goals.map((goal) => goal.target));

  return (
    <>
      <PageHeader
        title="Mes objectifs"
        subtitle="Ce que tu construis, petit à petit"
        actions={
          <div className="hidden sm:block">
            <Button onClick={openGoalSheet}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Nouvel objectif
            </Button>
          </div>
        }
      />

      <section className="relative mb-5 animate-rise overflow-hidden rounded-hero bg-linear-to-br from-lilac-100 via-lilac-50 to-blush-50 p-6 shadow-card ring-1 ring-ink/[0.04] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-lilac-300/40 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-semibold text-ink-soft">Épargne totale</p>
            <p className="mt-1 text-[48px] font-semibold leading-none tracking-tight sm:text-[56px]">
              <Money value={totalSaved} />
            </p>
            <p className="mt-3 text-[15px] text-ink-soft">
              sur <Money value={totalTarget} /> visés · {goals.length} objectif{goals.length > 1 ? "s" : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-surface/85 px-4 py-2.5 text-[15px] font-semibold shadow-sm sm:self-auto">
            <Target size={17} className="text-lilac-700" aria-hidden />
            <Money value={summary.saved} sign="always" /> ce mois-ci
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {goals.map((goal, index) => (
          <div key={goal.id} className="animate-rise" style={{ animationDelay: `${(index + 1) * 60}ms` }}>
            <GoalCard goal={goal} today={today} onContribute={() => openAdd({ kind: "saving", goalId: goal.id })} />
          </div>
        ))}
        <button
          type="button"
          onClick={openGoalSheet}
          className="lift flex min-h-56 animate-rise flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-blush-200 bg-surface/60 p-6 text-center transition-colors duration-200 hover:bg-blush-50"
          style={{ animationDelay: `${(goals.length + 1) * 60}ms` }}
        >
          <span className="grid size-12 place-items-center rounded-full bg-blush-100">
            <Plus size={22} strokeWidth={2.2} aria-hidden />
          </span>
          <span className="font-semibold">Nouvel objectif</span>
          <span className="text-sm text-muted">Un voyage, un projet, un coussin de sécurité…</span>
        </button>
      </div>
    </>
  );
}
