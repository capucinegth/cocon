"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/dates";

interface MonthSwitcherProps {
  month: string;
  /** Mois consultables, triés. */
  months: string[];
  onChange: (month: string) => void;
  className?: string;
}

const arrow =
  "grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors duration-200 hover:bg-blush-50 active:scale-95 disabled:pointer-events-none disabled:text-muted-soft/40";

/** « ‹ Septembre 2026 › » — navigation entre les mois disponibles. */
export function MonthSwitcher({ month, months, onChange, className }: MonthSwitcherProps) {
  const index = months.indexOf(month);
  const previous = months[index - 1];
  const next = months[index + 1];

  return (
    <div className={cn("inline-flex items-center rounded-full bg-surface p-0.5 shadow-card ring-1 ring-ink/5", className)}>
      <button type="button" className={arrow} disabled={!previous} onClick={() => previous && onChange(previous)} aria-label="Mois précédent">
        <ChevronLeft size={20} aria-hidden />
      </button>
      <span className="min-w-36 px-1 text-center text-[15px] font-semibold" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button type="button" className={arrow} disabled={!next} onClick={() => next && onChange(next)} aria-label="Mois suivant">
        <ChevronRight size={20} aria-hidden />
      </button>
    </div>
  );
}
