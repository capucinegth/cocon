import { formatMoney, formatPercent } from "@/lib/format";

export interface RankedItem {
  id: string;
  emoji: string;
  label: string;
  value: number;
}

/** Barres horizontales classées, une seule teinte : la longueur fait la comparaison, le texte donne la valeur. */
export function RankedBars({ items, title }: { items: RankedItem[]; title: string }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((acc, item) => acc + item.value, 0);

  return (
    <ul aria-label={title} className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id}>
          <div className="flex items-baseline gap-3">
            <span aria-hidden className="text-base">
              {item.emoji}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{item.label}</span>
            <span className="tabular text-[13px] text-muted">{formatPercent(item.value / total)}</span>
            <span className="tabular w-[5.5rem] text-right text-[15px] font-semibold">{formatMoney(item.value)}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-blush-50">
            <div
              className="h-full origin-left animate-grow rounded-r-[4px] rounded-l-full bg-blush-300"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
