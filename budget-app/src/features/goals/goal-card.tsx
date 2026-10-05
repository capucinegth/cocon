"use client";

import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StatusPill } from "@/components/ui/status-pill";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import { formatMonthLower } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { getGoalProgress, type GoalPace } from "@/lib/goals";
import type { SavingsGoal } from "@/types/finance";

const paceCopy: Record<GoalPace, { status: "done" | "scheduled" | "warning"; label: string } | null> = {
  done: { status: "done", label: "Atteint" },
  ahead: { status: "done", label: "En avance" },
  "on-track": { status: "done", label: "Dans les temps" },
  late: { status: "warning", label: "Un peu juste" },
  "no-deadline": null,
};

interface GoalCardProps {
  goal: SavingsGoal;
  today: string;
  onContribute: () => void;
}

export function GoalCard({ goal, today, onContribute }: GoalCardProps) {
  const progress = getGoalProgress(goal, today);
  const pace = paceCopy[progress.pace];

  return (
    <article className={cn("flex h-full flex-col rounded-card p-5 ring-1 ring-ink/[0.04] sm:p-6", toneStyles[goal.tone].surface)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span aria-hidden className="grid size-12 place-items-center rounded-[18px] bg-surface/85 text-2xl">
            {goal.emoji}
          </span>
          <h2 className="mt-3 break-words text-lg font-semibold tracking-tight">{goal.label}</h2>
          <p className="mt-0.5 text-[15px]">
            <Money value={goal.saved} className="font-semibold" />
            <span className="text-ink-soft">
              {" "}
              / <Money value={goal.target} />
            </span>
          </p>
        </div>
        <ProgressRing value={progress.ratio} tone={goal.tone} size={92} strokeWidth={9} label={`${goal.label} : ${formatPercent(progress.ratio)}`}>
          <span className="text-lg font-semibold tracking-tight">{formatPercent(progress.ratio)}</span>
        </ProgressRing>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-surface/75 p-4">
        <div>
          <dt className="text-[12px] font-medium text-ink-soft">Il reste</dt>
          <dd className="text-[15px] font-semibold">
            <Money value={progress.remaining} />
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-ink-soft">Chaque mois</dt>
          <dd className="text-[15px] font-semibold">
            <Money value={goal.monthlyContribution} sign="always" />
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] font-medium text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Flag size={14} aria-hidden />
          {goal.deadline ? `Cible : ${formatMonthLower(goal.deadline)}` : "Sans date cible"}
        </span>
        {pace && <StatusPill status={pace.status}>{pace.label}</StatusPill>}
      </div>
      {progress.eta && progress.pace !== "done" && (
        <p className="mt-1.5 text-[13px] text-ink-soft">À ce rythme : {formatMonthLower(progress.eta)}</p>
      )}

      <div className="mt-auto pt-5">
        <Button variant="white" onClick={onContribute} className="w-full">
          <Plus size={17} strokeWidth={2.4} aria-hidden />
          Verser
        </Button>
      </div>
    </article>
  );
}
