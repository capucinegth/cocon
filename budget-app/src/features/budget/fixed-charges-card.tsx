"use client";

import { Repeat } from "lucide-react";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { findAccount } from "@/config/accounts";
import { cn } from "@/lib/cn";
import { dayOfMonth, formatMonthLower } from "@/lib/dates";
import { getFixedChargesByAccount, type FixedCharge } from "@/lib/fixed-charges";
import { roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/** « le 5 », « chaque semaine ×4 », et la destination d'un virement d'épargne. */
function chargeDetail(charge: FixedCharge, accounts: ReturnType<typeof useBudget>["accounts"]): string {
  const { rule, dates } = charge;
  const when = rule.frequency === "monthly" ? `le ${dayOfMonth(dates[0])}` : `chaque semaine ×${dates.length}`;
  if (rule.kind === "saving" && rule.transferAccountId) return `${when} · vers ${findAccount(accounts, rule.transferAccountId).label}`;
  return when;
}

/**
 * Ce qui part d'office de chaque compte dans le mois (prélèvements réguliers et virements d'épargne),
 * pour savoir ce qu'il faut y prévoir. Mois en cours : ce qui reste à prélever et le solde après.
 */
export function FixedChargesCard({ month }: { month: string }) {
  const data = useBudget();
  const { accounts, currentMonth } = data;
  const { openRecurring } = useUI();
  const entries = useMemo(() => getFixedChargesByAccount(data, month), [data, month]);
  const current = month === currentMonth;
  const grandTotal = roundCents(entries.reduce((acc, e) => acc + e.monthly, 0));

  return (
    <Card>
      <SectionHeader
        title="Charges fixes par compte"
        subtitle={current ? "Ce qui part d'office ce mois-ci" : `Ce qui partira d'office en ${formatMonthLower(month)}`}
      />
      {entries.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-muted">
          <Repeat size={16} className="mt-0.5 shrink-0" aria-hidden />
          Aucune charge fixe active sur tes comptes. Ajoute-en une (loyer, abonnement…) dans « Prélèvements et revenus réguliers ».
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.account.id} className="rounded-2xl bg-canvas p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-xl">
                  {entry.account.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-semibold">{entry.account.label}</span>
                  <span className="block text-[13px] text-muted">
                    {entry.charges.length} charge{entry.charges.length > 1 ? "s" : ""} fixe{entry.charges.length > 1 ? "s" : ""}
                  </span>
                </span>
                <Money value={-entry.monthly} cents="always" className="tabular shrink-0 text-[15px] font-semibold" />
              </div>

              <ul className="mt-3 border-t border-line pt-2">
                {entry.charges.map((charge) => (
                  <li key={charge.rule.id}>
                    <button
                      type="button"
                      onClick={() => openRecurring(charge.rule.id)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-blush-50/70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-[14px]">{charge.rule.label}</span>{" "}
                        <span className="text-[12px] text-muted">{chargeDetail(charge, accounts)}</span>
                      </span>
                      <Money value={-charge.total} cents="always" className="tabular shrink-0 text-[14px] text-ink-soft" />
                    </button>
                  </li>
                ))}
              </ul>

              {current && (
                <dl className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Sur le compte aujourd&apos;hui</dt>
                    <dd>
                      <Money value={entry.balance} cents="always" className="tabular" />
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Encore à prélever ce mois-ci</dt>
                    <dd>
                      <Money value={-entry.remaining} cents="always" className="tabular" />
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-semibold text-ink-soft">Après ces prélèvements</dt>
                    <dd>
                      <Money
                        value={entry.afterCharges}
                        cents="always"
                        className={cn("tabular text-[15px] font-semibold", entry.afterCharges < 0 && "text-blush-700")}
                      />
                    </dd>
                  </div>
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
      {entries.length > 1 && (
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-line px-1 pt-3">
          <span className="text-[14px] text-ink-soft">Total, tous comptes</span>
          <Money value={-grandTotal} cents="always" className="tabular text-[15px] font-semibold" />
        </div>
      )}
    </Card>
  );
}
