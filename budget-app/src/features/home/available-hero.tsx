"use client";

import { CircleCheck } from "lucide-react";
import { HealthPill, healthHint } from "@/components/ui/health-pill";
import { HeroMoney, Money } from "@/components/ui/money";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import type { MonthSummary } from "@/lib/budget";
import { formatMonthName } from "@/lib/dates";
import { formatPercent } from "@/lib/format";

/**
 * Carte principale : « combien puis-je réellement dépenser ? ».
 * Hiérarchie : disponible → par jour → nombre de jours → état du budget.
 */
export function AvailableHero({ summary }: { summary: MonthSummary }) {
  const remaining = useAnimatedNumber(summary.remaining);
  const perDay = useAnimatedNumber(summary.perDay);
  const monthProgress = summary.dayOfMonth / summary.daysInMonth;
  const monthName = formatMonthName(summary.month).toLowerCase();
  const elided = /^[aeiouyéè]/i.test(monthName) ? `d'${monthName}` : `de ${monthName}`;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative h-full overflow-hidden rounded-hero bg-linear-to-br from-blush-100 via-blush-50 to-lilac-50 p-6 shadow-card ring-1 ring-ink/[0.04] sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-blush-300/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-6 size-60 rounded-full bg-lilac-100/70 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <p id="hero-title" className="pt-1 text-base font-semibold text-ink-soft">
            {summary.isPast ? "Il t'est resté" : "Il te reste"}
          </p>
          <span title={healthHint(summary.health)}>
            <HealthPill health={summary.health} className="bg-surface/85 shadow-sm" />
          </span>
        </div>

        <p className="mt-2 font-semibold leading-none tracking-tight" aria-live="polite">
          <HeroMoney value={remaining} className="text-[56px] min-[400px]:text-[64px] sm:text-[80px]" centsClassName="text-[28px] min-[400px]:text-[32px] sm:text-[40px]" />
        </p>

        <p className="mt-5 text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">
          ≈ <Money value={perDay} cents="always" />
          <span className="text-[17px] font-medium text-ink-soft sm:text-xl"> / jour</span>
        </p>
        <p className="mt-1 text-base text-ink-soft">
          {summary.isPast ? (
            <>dépensés en moyenne au quotidien</>
          ) : (
            <>
              pour les <span className="font-semibold text-ink">{summary.daysLeft} prochains jours</span>
            </>
          )}
        </p>

        <div className="mt-auto pt-7">
          {!summary.isPast && (
            <>
              <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-ink-soft">
                <span>
                  Jour {summary.dayOfMonth} sur {summary.daysInMonth}
                </span>
                <span>{formatPercent(monthProgress)} du mois</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface/70">
                <div className="h-full origin-left animate-grow rounded-full bg-blush-300" style={{ width: `${monthProgress * 100}%` }} />
              </div>
            </>
          )}
          <p className="mt-4 flex items-start gap-1.5 text-[13px] font-medium text-ink-soft">
            <CircleCheck size={15} className="mt-px shrink-0 text-sage-700" aria-hidden />
            {summary.isPast
              ? `Bilan ${elided} : revenus moins dépenses et épargne.`
              : "Charges fixes, épargne et dépenses prévues déjà déduites."}
          </p>
        </div>
      </div>
    </section>
  );
}
