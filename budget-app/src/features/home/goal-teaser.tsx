"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Money } from "@/components/ui/money";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatPercent } from "@/lib/format";
import { useBudget } from "@/store/budget-store";

/** Raccourci vers l'objectif le plus avancé. */
export function GoalTeaser() {
  const { goals } = useBudget();
  const goal = [...goals].filter((g) => g.saved < g.target).sort((a, b) => b.saved / b.target - a.saved / a.target)[0] ?? goals[0];
  if (!goal) return null;
  const ratio = goal.saved / goal.target;

  return (
    <Link href="/objectifs" className="lift group flex items-center gap-4 rounded-card bg-lilac-50 p-5 ring-1 ring-ink/[0.04]">
      <ProgressRing value={ratio} tone="lilac" size={64} strokeWidth={7} label={`${goal.label} : ${formatPercent(ratio)}`}>
        <span className="text-[13px] font-semibold">{formatPercent(ratio)}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-soft">Objectif en vue</p>
        <p className="break-words text-[17px] font-semibold">
          {goal.emoji} {goal.label}
        </p>
        <p className="text-[13px] text-ink-soft">
          <Money value={goal.saved} /> sur <Money value={goal.target} />
        </p>
      </div>
      <ChevronRight size={20} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
