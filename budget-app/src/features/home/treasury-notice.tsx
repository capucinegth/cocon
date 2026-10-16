"use client";

import { TriangleAlert } from "lucide-react";
import { Money } from "@/components/ui/money";
import { formatLongDate } from "@/lib/dates";
import type { TreasuryAlert } from "@/lib/treasury";

/**
 * Garde de trésorerie (option A) : affichée uniquement si l'argent des comptes, après les opérations
 * à venir, ne suffit pas. Le chiffre du budget reste affiché tel quel au-dessus.
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
          {alert.kind === "overdraft" ? (
            <>
              Après tes prochaines opérations, ton solde pourrait descendre à <Money value={alert.lowest} cents="always" className="font-semibold text-ink" /> le{" "}
              {formatLongDate(alert.date).toLowerCase()}
              {alert.beforeExpectedIncome ? ", avant l'arrivée de tes revenus attendus" : ""}.
            </>
          ) : (
            <>
              Après tes prochaines opérations, il ne resterait que <Money value={alert.endBalance} cents="always" className="font-semibold text-ink" /> sur tes
              comptes en fin de mois, moins que les <Money value={alert.remaining} cents="always" className="font-semibold text-ink" /> que ton budget te laisse.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
