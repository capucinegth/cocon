"use client";

import { Plus, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { RecurringRule } from "@/types/finance";

const frequencyLabel: Record<RecurringRule["frequency"], string> = { weekly: "Chaque semaine", monthly: "Chaque mois" };

/** Loyer, salaire, abonnements… : ce qui revient tout seul, et sa prochaine échéance. */
export function RecurringCard() {
  const { recurring } = useBudget();
  const categoryOf = useCategoryLookup();
  const { openRecurring, openFixedCharge } = useUI();
  const rules = [...recurring].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.nextOccurrence.localeCompare(b.nextOccurrence));

  return (
    <Card>
      <SectionHeader
        title="Prélèvements et revenus réguliers"
        subtitle="Ajoutés automatiquement à chaque échéance"
        aside={
          <button
            type="button"
            onClick={openFixedCharge}
            className="-mr-2 inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-blush-700 transition-colors hover:bg-blush-50"
          >
            <Plus size={16} aria-hidden />
            Charge fixe
          </button>
        }
      />
      {rules.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
          <Repeat size={16} className="mt-0.5 shrink-0" aria-hidden />
          Aucune pour l&apos;instant. Ajoute une charge fixe (loyer, abonnement…) avec son jour de prélèvement, ou choisis « Chaque mois » en ajoutant une opération.
        </p>
      ) : (
        <ul className="-mx-3 -my-1">
          {rules.map((rule) => {
            const category = categoryOf(rule.categoryId);
            const signed = rule.kind === "income" ? rule.amount : -rule.amount;
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  onClick={() => openRecurring(rule.id)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-blush-50/70 active:bg-blush-50"
                >
                  <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] font-semibold">{rule.label}</span>
                    <span className="block text-[13px] text-muted">
                      {rule.isActive ? `${frequencyLabel[rule.frequency]} · prochaine le ${formatShortDate(rule.nextOccurrence)}` : "En pause"}
                    </span>
                  </span>
                  <Money
                    value={signed}
                    sign="always"
                    className={cn("tabular shrink-0 text-[15px] font-semibold", signed > 0 && "text-sage-700", !rule.isActive && "text-muted")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
