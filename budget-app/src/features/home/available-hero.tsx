"use client";

import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { HealthPill, healthHint } from "@/components/ui/health-pill";
import { HeroMoney, Money } from "@/components/ui/money";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import type { MonthSummary } from "@/lib/budget";

/**
 * Réponse principale de Cocon : « combien puis-je encore dépenser ? » (budget du mois en cours).
 * Hiérarchie : montant → par jour → état du budget expliqué. La phrase de contexte n'est affichée
 * que si les données la justifient (jamais quand une alerte de trésorerie est présente).
 */
export function AvailableHero({ summary, reassure = true }: { summary: MonthSummary; reassure?: boolean }) {
  const remaining = useAnimatedNumber(summary.remaining);
  const perDay = useAnimatedNumber(summary.perDay);
  const showContext = summary.health !== "comfortable" || reassure;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative h-full overflow-hidden rounded-hero bg-linear-to-br from-blush-100 via-blush-50 to-lilac-50 p-6 shadow-card ring-1 ring-ink/[0.04] sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-blush-300/25 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <h2 id="hero-title" className="pt-1 text-base font-semibold text-ink-soft">
            Tu peux encore dépenser
          </h2>
          <HealthPill health={summary.health} className="bg-surface/85 shadow-sm" />
        </div>

        <p className="mt-2 font-semibold leading-none tracking-tight" aria-live="polite">
          <HeroMoney
            value={remaining}
            className="text-[clamp(2.75rem,14vw,4rem)] sm:text-[80px]"
            centsClassName="text-[clamp(1.375rem,7vw,2rem)] sm:text-[40px]"
          />
        </p>

        <p className="mt-4 text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">
          ≈ <Money value={perDay} cents="always" />
          <span className="text-base font-medium text-ink-soft sm:text-lg"> / jour</span>
          <span className="block text-base font-medium text-ink-soft sm:inline sm:text-lg">
            <span className="max-sm:hidden"> · </span>pour les <span className="font-semibold text-ink">{summary.daysLeft} prochains jours</span>
          </span>
        </p>

        {showContext && <p className="mt-5 text-[15px] font-medium leading-snug text-ink">{healthHint(summary.health)}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-5">
          <p className="flex items-start gap-1.5 text-[13px] font-medium text-ink-soft">
            <CircleCheck size={15} className="mt-px shrink-0 text-sage-700" aria-hidden />
            Charges fixes, épargne et dépenses prévues déjà déduites.
          </p>
          <Link
            href="/budget"
            className="-mx-3 inline-flex min-h-11 items-center gap-0.5 rounded-full px-3 text-[13px] font-semibold text-blush-700 transition-colors hover:bg-surface/70"
          >
            Voir le calcul
            <ChevronRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
