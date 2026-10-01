"use client";

import { Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import { GoalCard } from "./goal-card";

export function GoalsScreen() {
  const { goals, summary } = useBudget();
  const { showToast } = useUI();
  const totalSaved = goals.reduce((acc, goal) => acc + goal.saved, 0);
  const totalTarget = goals.reduce((acc, goal) => acc + goal.target, 0);
  const announceSoon = () => showToast("La création d'objectifs arrive bientôt");

  return (
    <>
      <PageHeader
        title="Objectifs"
        subtitle="Ce que tu construis, petit à petit"
        actions={
          <div className="hidden sm:block">
            <Button variant="soft" onClick={announceSoon}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Nouvel objectif
            </Button>
          </div>
        }
      />

      <section className="relative mb-5 animate-rise overflow-hidden rounded-hero bg-linear-to-br from-lilac-100 via-lilac-50 to-blush-50 p-6 shadow-card sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-lilac-300/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-semibold text-ink/70">Épargne totale</p>
            <p className="mt-1 text-[48px] font-semibold leading-none tracking-tight sm:text-[56px]">{formatMoney(totalSaved)}</p>
            <p className="mt-3 text-[15px] text-ink/70">
              sur {formatMoney(totalTarget)} visés pour {goals.length} objectifs
            </p>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-surface/85 px-4 py-2.5 text-[15px] font-semibold shadow-sm sm:self-auto">
            <Target size={17} className="text-lilac-700" aria-hidden />
            {formatMoney(summary.saved, { sign: "always" })} ce mois-ci
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {goals.map((goal, index) => (
          <div key={goal.id} className="animate-rise" style={{ animationDelay: `${(index + 1) * 60}ms` }}>
            <GoalCard goal={goal} />
          </div>
        ))}
        <button
          type="button"
          onClick={announceSoon}
          className="flex min-h-48 animate-rise flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-blush-200 bg-surface/50 p-6 text-center transition-colors duration-200 hover:bg-blush-50"
          style={{ animationDelay: `${(goals.length + 1) * 60}ms` }}
        >
          <span className="grid size-12 place-items-center rounded-full bg-blush-100">
            <Plus size={22} strokeWidth={2.2} aria-hidden />
          </span>
          <span className="font-semibold">Créer un objectif</span>
          <span className="text-sm text-muted">Un voyage, un projet, un coussin de sécurité…</span>
        </button>
      </div>
    </>
  );
}
