import { Flag } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import { formatMonthLower } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/format";
import type { SavingsGoal } from "@/types/finance";

export function GoalCard({ goal }: { goal: SavingsGoal }) {
  const ratio = goal.saved / goal.target;
  const styles = toneStyles[goal.tone];

  return (
    <article className={cn("flex flex-col rounded-card p-6 transition-transform duration-300 hover:-translate-y-0.5", styles.surface)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span aria-hidden className="grid size-14 place-items-center rounded-[20px] bg-surface/85 text-2xl">
            {goal.emoji}
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">{goal.label}</h2>
          <p className="mt-1 text-[15px]">
            <span className="font-semibold">{formatMoney(goal.saved)}</span>
            <span className="text-muted"> / {formatMoney(goal.target)}</span>
          </p>
        </div>
        <ProgressRing value={ratio} tone={goal.tone} size={96} strokeWidth={9} label={`${goal.label} : ${formatPercent(ratio)}`}>
          <span className="text-xl font-semibold tracking-tight">{formatPercent(ratio)}</span>
        </ProgressRing>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-surface/70 p-4">
        <div>
          <dt className="text-[12px] font-medium text-muted">Il reste</dt>
          <dd className="text-[15px] font-semibold">{formatMoney(goal.target - goal.saved)}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-muted">Chaque mois</dt>
          <dd className="text-[15px] font-semibold">{formatMoney(goal.monthlyContribution, { sign: "always" })}</dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-muted">
        <Flag size={14} aria-hidden />
        {goal.deadline ? `Objectif : ${formatMonthLower(goal.deadline)}` : "Sans échéance"}
      </p>
    </article>
  );
}
