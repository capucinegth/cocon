import { CategoryBadge } from "@/components/ui/category-badge";
import { getAccount } from "@/config/accounts";
import { getCategory } from "@/config/categories";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { AccountId, CategoryId, TransactionKind } from "@/types/finance";

interface TransactionRowProps {
  label: string;
  amount: number;
  kind: TransactionKind;
  categoryId: CategoryId;
  accountId: AccountId;
  /** Opération prévue, pas encore passée. */
  scheduledLabel?: string;
}

export function TransactionRow({ label, amount, kind, categoryId, accountId, scheduledLabel }: TransactionRowProps) {
  const category = getCategory(categoryId);
  const signed = kind === "income" ? amount : -amount;

  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-200 hover:bg-blush-50/60">
      <CategoryBadge emoji={category.emoji} tone={category.tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{label}</p>
        <p className="truncate text-[13px] text-muted">
          {scheduledLabel ?? category.label} · {getAccount(accountId).label}
        </p>
      </div>
      <span
        className={cn(
          "tabular shrink-0 text-[15px] font-semibold whitespace-nowrap",
          kind === "income" && "text-sage-700",
          scheduledLabel && "text-muted",
        )}
      >
        {formatMoney(signed, { sign: "always" })}
      </span>
    </li>
  );
}
