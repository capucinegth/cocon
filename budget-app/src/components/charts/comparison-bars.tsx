import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDelta, formatMoney } from "@/lib/format";

export interface ComparisonItem {
  id: string;
  emoji: string;
  label: string;
  current: number;
  previous: number;
}

interface ComparisonBarsProps {
  items: ComparisonItem[];
  currentLabel: string;
  previousLabel: string;
}

/** Hausse / baisse d'une dépense : toujours une flèche + un texte, jamais la couleur seule. */
function DeltaPill({ current, previous }: { current: number; previous: number }) {
  const delta = previous > 0 ? (current - previous) / previous : 0;
  const rounded = Math.round(delta * 100);
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] font-semibold",
        rounded > 0 ? "bg-peach-50 text-peach-700" : rounded < 0 ? "bg-sage-50 text-sage-700" : "bg-canvas text-muted",
      )}
    >
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {rounded === 0 ? "Stable" : formatDelta(delta)}
    </span>
  );
}

/** Deux barres par catégorie (mois en cours / mois précédent), une teinte en deux nuances. */
export function ComparisonBars({ items, currentLabel, previousLabel }: ComparisonBarsProps) {
  const max = Math.max(...items.flatMap((item) => [item.current, item.previous]), 1);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-medium text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-4 rounded-[3px] bg-blush-500" />
          {currentLabel}
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-4 rounded-[3px] bg-blush-200" />
          {previousLabel}
        </span>
      </div>

      <ul className="flex flex-col gap-5">
        {items.map((item) => (
          <li key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[15px] font-medium">
                <span aria-hidden>{item.emoji}</span> {item.label}
              </span>
              <DeltaPill current={item.current} previous={item.previous} />
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {[
                { value: item.current, className: "bg-blush-500", text: "font-semibold text-ink", label: currentLabel },
                { value: item.previous, className: "bg-blush-200", text: "text-muted", label: previousLabel },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <div className="h-2.5 flex-1">
                    <div
                      role="img"
                      aria-label={`${item.label}, ${bar.label} : ${formatMoney(bar.value)}`}
                      className={cn("h-full origin-left animate-grow rounded-r-[4px]", bar.className)}
                      style={{ width: `${(bar.value / max) * 100}%` }}
                    />
                  </div>
                  <span className={cn("tabular w-[4.5rem] text-right text-[13px]", bar.text)}>{formatMoney(bar.value)}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
