import { CategoryBadge } from "@/components/ui/category-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusPill } from "@/components/ui/status-pill";
import { getUsageStatus } from "@/lib/budget";
import { formatShortDate } from "@/lib/dates";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Tone } from "@/types/finance";

export type LineMode = "expense" | "fixed" | "income" | "saving";

const columnLabels: Record<LineMode, [string, string, string]> = {
  expense: ["Budget", "Dépensé", "Restant"],
  fixed: ["Budget", "Payé", "Restant"],
  income: ["Prévu", "Reçu", "À recevoir"],
  saving: ["Prévu", "Versé", "Restant"],
};

export interface BudgetLineProps {
  mode: LineMode;
  label: string;
  emoji: string;
  tone: Tone;
  planned: number;
  done: number;
  upcoming?: number;
  nextDate?: string;
}

function LineStatus({ mode, planned, done, upcoming = 0, nextDate }: BudgetLineProps) {
  const ratio = planned > 0 ? (done + upcoming) / planned : 0;
  const complete = planned > 0 && done >= planned - 0.005;

  if (mode === "income") return complete ? <StatusPill status="done">Reçu</StatusPill> : <StatusPill status="scheduled">En attente</StatusPill>;
  if (mode === "saving") return complete ? <StatusPill status="done">Versé</StatusPill> : <StatusPill status="scheduled">À verser</StatusPill>;
  if (upcoming > 0 && nextDate) return <StatusPill status="scheduled">Le {formatShortDate(nextDate)}</StatusPill>;
  if (mode === "fixed" && complete) return <StatusPill status="done">Payé</StatusPill>;

  const status = getUsageStatus(ratio);
  if (status === "over") return <StatusPill status="over">Dépassé</StatusPill>;
  if (status === "warning") return <StatusPill status="warning">Bientôt atteint</StatusPill>;
  return <span className="text-[13px] font-semibold text-muted">{formatPercent(ratio)}</span>;
}

/** Une ligne de budget : prévu / réalisé / restant + barre de progression. */
export function BudgetLine(props: BudgetLineProps) {
  const { mode, label, emoji, tone, planned, done, upcoming = 0 } = props;
  const [plannedLabel, doneLabel, remainingLabel] = columnLabels[mode];
  const remaining = planned - done - upcoming;

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <CategoryBadge emoji={emoji} tone={tone} size="sm" />
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{label}</p>
        <LineStatus {...props} />
      </div>

      <ProgressBar
        className="mt-3"
        value={planned > 0 ? done / planned : 0}
        pending={planned > 0 ? upcoming / planned : 0}
        tone={tone}
        label={`${label} : ${formatMoney(done)} sur ${formatMoney(planned)}`}
      />

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[12px] font-medium text-muted">{plannedLabel}</dt>
          <dd className="tabular text-[15px] font-semibold">{formatMoney(planned)}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-medium text-muted">{doneLabel}</dt>
          <dd className="tabular text-[15px] font-semibold">{formatMoney(done)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-[12px] font-medium text-muted">{remainingLabel}</dt>
          <dd className="tabular text-[15px] font-semibold">{formatMoney(Math.max(remaining, 0))}</dd>
        </div>
      </dl>
      {upcoming > 0 && (
        <p className="mt-2 text-[13px] text-muted">dont {formatMoney(upcoming)} déjà prévus d&apos;ici la fin du mois</p>
      )}
    </li>
  );
}
