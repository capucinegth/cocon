import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Tone } from "@/types/finance";

interface BudgetGroupCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  /** Montant réalisé (+ prévu) du groupe. */
  amount: number;
  planned: number;
  children: ReactNode;
  className?: string;
}

/** Section du budget (Revenus, Charges fixes…) avec son total en en-tête. */
export function BudgetGroupCard({ title, description, icon: Icon, tone, amount, planned, children, className }: BudgetGroupCardProps) {
  return (
    <Card className={className}>
      <header className="mb-6 flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", toneStyles[tone].badge)}>
          <Icon size={20} strokeWidth={1.9} className="text-ink/80" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          <p className="truncate text-sm text-muted">{description}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-[17px] font-semibold">{formatMoney(amount)}</p>
          <p className="tabular text-[13px] text-muted">sur {formatMoney(planned)}</p>
        </div>
      </header>
      <ul className="divide-y divide-line">{children}</ul>
    </Card>
  );
}
