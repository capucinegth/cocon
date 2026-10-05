import { Repeat } from "lucide-react";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/cn";
import type { Category } from "@/types/finance";

interface TransactionRowProps {
  label: string;
  category: Category;
  /** Ligne secondaire (catégorie · date · compte…). */
  subtitle: string;
  /** Montant signé : positif = entrée, négatif = sortie. */
  amount: number;
  recurring?: boolean;
  /** Mouvement prévu, pas encore passé. */
  planned?: boolean;
  /** Vient d'être ajouté : léger halo. */
  highlighted?: boolean;
  onClick?: () => void;
}

/** Une opération : icône, nom, catégorie / date, montant. Cliquable pour voir le détail. */
export function TransactionRow({ label, category, subtitle, amount, recurring, planned, highlighted, onClick }: TransactionRowProps) {
  const content = (
    <>
      <CategoryBadge emoji={category.emoji} tone={category.tone} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 break-words text-[15px] font-semibold">{label}</span>
          {recurring && <Repeat size={13} strokeWidth={2.2} className="shrink-0 text-muted" aria-label="Récurrent" />}
        </span>
        <span className="block break-words text-[13px] text-muted">{subtitle}</span>
      </span>
      <Money
        value={amount}
        sign="always"
        className={cn("tabular shrink-0 text-[15px] font-semibold", amount > 0 && "text-sage-700", planned && "text-muted")}
      />
    </>
  );

  const className = cn(
    "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
    highlighted && "animate-flash",
  );

  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className={cn(className, "transition-colors duration-200 hover:bg-blush-50/70 active:bg-blush-50")}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}
