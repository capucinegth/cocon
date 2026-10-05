import { Check, CircleAlert } from "lucide-react";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getUsageStatus, type CategoryUsage } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

/**
 * Une catégorie du budget : dépensé / prévu, reste, et une barre très discrète.
 * Toute la ligne ouvre la modification (le bouton porte le nom de la catégorie).
 */
export function CategoryBudgetRow({ usage, onEdit }: { usage: CategoryUsage; onEdit?: () => void }) {
  const { category, planned, done, upcoming, remaining, ratio } = usage;
  const spent = done + upcoming;
  const status = planned > 0 ? getUsageStatus(ratio) : "ok";
  const isFixed = category.group === "fixes";

  return (
    <li className="relative py-4 first:pt-1 last:pb-1">
      <div className="flex items-center gap-3">
        <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer break-words text-left text-[15px] font-semibold outline-none transition-colors duration-200 after:absolute after:-inset-x-2 after:inset-y-0 after:rounded-2xl hover:text-blush-700 focus-visible:after:ring-2 focus-visible:after:ring-blush-700"
              >
                {category.label}
                <span className="sr-only"> : modifier le budget</span>
              </button>
            ) : (
              <span className="break-words text-[15px] font-semibold">{category.label}</span>
            )}
            {isFixed && (
              <span className="shrink-0 rounded-full bg-lilac-50 px-2 py-0.5 text-[11px] font-semibold text-lilac-700">Fixe</span>
            )}
          </p>
        </div>
        <p className="shrink-0 text-right text-[15px]">
          <Money value={spent} className="tabular font-semibold" />
          <span className="text-muted">
            {" "}
            / <Money value={planned} />
          </span>
        </p>
      </div>

      <div className="mt-2.5 pl-12">
        <ProgressBar
          size="sm"
          value={planned > 0 ? done / planned : 0}
          pending={planned > 0 ? upcoming / planned : 0}
          tone={category.tone}
          label={`${category.label} : ${formatMoney(spent)} sur ${formatMoney(planned)}`}
        />
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px]">
          {planned === 0 ? (
            <span className="text-muted">Pas encore de budget défini</span>
          ) : remaining < 0 ? (
            <span className="font-medium text-blush-700">
              <CircleAlert size={13} className="mr-1 inline align-[-2px]" aria-hidden />
              <Money value={-remaining} /> de dépassement
            </span>
          ) : isFixed && remaining === 0 ? (
            <span className="font-medium text-sage-700">
              <Check size={13} strokeWidth={2.6} className="mr-1 inline align-[-2px]" aria-hidden />
              {upcoming > 0 ? "Entièrement prévu" : "Payé"}
            </span>
          ) : remaining === 0 ? (
            <span className="font-medium text-peach-700">
              <CircleAlert size={13} className="mr-1 inline align-[-2px]" aria-hidden />
              Budget atteint
            </span>
          ) : (
            <span className={cn("font-medium", status === "warning" && !isFixed ? "text-peach-700" : "text-ink-soft")}>
              {status === "warning" && !isFixed && <CircleAlert size={13} className="mr-1 inline align-[-2px]" aria-hidden />}
              <Money value={remaining} /> {isFixed ? "de marge" : remaining > 1 ? "restants" : "restant"}
            </span>
          )}
          {upcoming > 0 && (
            <span className="text-muted">
              · dont <Money value={upcoming} /> à venir
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
