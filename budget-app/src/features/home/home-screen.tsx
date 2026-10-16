"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { monthUpcoming } from "@/lib/budget";
import { capitalize, formatLongDate } from "@/lib/dates";
import { getTreasuryAlert } from "@/lib/treasury";
import { useBudget } from "@/store/budget-store";
import { AvailableHero } from "./available-hero";
import { MoneyOverview } from "./money-overview";
import { RecentTransactions } from "./recent-transactions";
import { TreasuryNotice } from "./treasury-notice";
import { UpcomingList } from "./upcoming-list";
import { WelcomeCard } from "./welcome-card";

/**
 * Accueil : TOUJOURS la situation actuelle (les mois passés se consultent dans Budget et Statistiques).
 * Ordre d'importance : ce que je peux dépenser → alerte éventuelle → prochainement → mon argent → dernières dépenses.
 * Mobile : une colonne. Tablette : deux colonnes sous le chiffre principal. Grand écran : essentiel à gauche,
 * anticipation à droite.
 */
export function HomeScreen() {
  const data = useBudget();
  const { summary } = data;
  const name = data.profile?.displayName.trim();
  // Nouveau compte : aucune opération, aucun budget, aucun objectif.
  const isNew = data.allTransactions.length === 0 && data.plans.length === 0 && data.goals.length === 0;
  const alert = useMemo(
    () =>
      getTreasuryAlert({
        accounts: data.accounts,
        transactions: data.allTransactions,
        upcoming: monthUpcoming(data, data.currentMonth),
        today: data.today,
        remaining: summary.remaining,
        incomeExpected: summary.incomeExpected,
      }),
    [data, summary],
  );

  return (
    <>
      <PageHeader title={name ? `Bonjour ${name} 👋` : "Bonjour 👋"} subtitle={capitalize(formatLongDate(data.today))} />

      {isNew && (
        <div className="mb-4 animate-rise sm:mb-5">
          <WelcomeCard name={name} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-12 xl:items-start">
        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:col-span-7">
          <div className="order-1 animate-rise md:col-span-2">
            <AvailableHero summary={summary} reassure={!alert} />
          </div>
          {alert && (
            <div className="order-2 animate-rise md:col-span-2">
              <TreasuryNotice alert={alert} />
            </div>
          )}
          <div className="order-5 animate-rise [animation-delay:150ms] md:col-span-2">
            <RecentTransactions />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5 max-xl:contents xl:col-span-5">
          <div className="order-3 animate-rise [animation-delay:60ms]">
            <UpcomingList />
          </div>
          <div className="order-4 animate-rise [animation-delay:110ms]">
            <MoneyOverview />
          </div>
        </div>
      </div>
    </>
  );
}
