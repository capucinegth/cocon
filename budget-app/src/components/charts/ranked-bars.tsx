import { Money } from "@/components/ui/money";
import { formatShare } from "@/lib/format";

export interface RankedItem {
  id: string;
  emoji: string;
  label: string;
  value: number;
}

/** Barres horizontales classées, une seule teinte : la longueur compare, le texte donne la valeur. */
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
            <span className="min-w-0 flex-1 break-words text-[15px] font-medium">{item.label}</span>
            <span className="tabular text-[13px] text-muted">{formatShare(total > 0 ? item.value / total : 0)}</span>
            <Money value={item.value} className="tabular w-[5.5rem] text-right text-[15px] font-semibold" />
          </div>
          <div className="mt-2 h-2 rounded-full bg-peach-50">
            <div
              className="h-full origin-left animate-grow rounded-l-full rounded-r-[4px] bg-peach-300"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
