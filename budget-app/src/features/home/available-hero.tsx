"use client";

import { CircleCheck, Sparkles } from "lucide-react";
import { formatMoney, formatPercent, splitMoney } from "@/lib/format";
import { useBudget } from "@/store/budget-store";

/** Carte principale : « combien puis-je encore dépenser ? » — l'information dominante. */
export function AvailableHero() {
  const { summary } = useBudget();
  const { units, cents } = splitMoney(summary.remaining);
  const monthProgress = summary.dayOfMonth / summary.daysInMonth;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative h-full overflow-hidden rounded-hero bg-linear-to-br from-blush-100 via-blush-50 to-lilac-50 p-6 shadow-card sm:p-8"
    >
      {/* Halos décoratifs */}
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-blush-300/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-6 size-60 rounded-full bg-lilac-100/80 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <p id="hero-title" className="text-base font-semibold text-ink/70">
          Il te reste
        </p>
        <p className="mt-2 font-semibold leading-none tracking-tight">
          <span className="text-[64px] sm:text-[80px]">{units}</span>
          <span className="text-[32px] sm:text-[40px]">{cents}&nbsp;€</span>
        </p>
        <p className="mt-3 text-base text-ink/70">
          pour les <span className="font-semibold text-ink">{summary.daysLeft} prochains jours</span>
        </p>

        <div className="mt-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface/85 px-4 py-2.5 text-base font-semibold shadow-sm backdrop-blur">
            <Sparkles size={17} className="text-blush-700" aria-hidden />
            ≈ {formatMoney(summary.perDay, { cents: "always" })} / jour
          </span>
        </div>

        <div className="mt-auto pt-8">
          <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-ink/70">
            <span>
              Jour {summary.dayOfMonth} sur {summary.daysInMonth}
            </span>
            <span>{formatPercent(monthProgress)} du mois</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface/70">
            <div
              className="h-full origin-left animate-grow rounded-full bg-blush-300"
              style={{ width: `${monthProgress * 100}%` }}
            />
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-ink/70">
            <CircleCheck size={15} className="text-sage-700" aria-hidden />
            Épargne et dépenses à venir déjà déduites
          </p>
        </div>
      </div>
    </section>
  );
}
