"use client";

import { TriangleAlert } from "lucide-react";
import { Money } from "@/components/ui/money";
import { formatLongDate } from "@/lib/dates";
import type { TreasuryAlert } from "@/lib/treasury";

/**
 * Garde de trésorerie : affichée uniquement si le solde des comptes, dans l'ordre des opérations à venir,
 * passerait sous zéro avant la fin du mois. Donne la date du point le plus bas.
 */
export function TreasuryNotice({ alert }: { alert: TreasuryAlert }) {
  return (
    <section aria-labelledby="treasury-title" className="flex items-start gap-3 rounded-card bg-peach-50 p-4 ring-1 ring-peach-100 sm:p-5">
      <TriangleAlert size={20} className="mt-0.5 shrink-0 text-peach-700" aria-hidden />
      <div className="min-w-0">
        <h2 id="treasury-title" className="text-[15px] font-semibold">
          Attention à l&apos;argent sur tes comptes
        </h2>
        <p className="mt-1 text-[14px] leading-snug text-ink-soft">
          Après tes prochaines opérations, ton solde pourrait descendre à <Money value={alert.lowest} cents="always" className="font-semibold text-ink" /> le{" "}
          {formatLongDate(alert.date).toLowerCase()}
          {alert.beforeExpectedIncome ? ", avant l'arrivée de tes revenus attendus" : ""}.
        </p>
      </div>
    </section>
  );
}
