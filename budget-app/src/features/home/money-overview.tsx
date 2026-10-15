"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { getMoneyOverview } from "@/lib/treasury";
import { useBudget } from "@/store/budget-store";

/**
 * « Mon argent » : trois chiffres qui ne disent pas la même chose, et ne se lisent pas comme
 * « ce que je peux dépenser » (c'est le rôle du chiffre principal).
 */
export function MoneyOverview() {
  const { accounts, allTransactions, today } = useBudget();
  const { onAccounts, savings, total } = getMoneyOverview(accounts, allTransactions, today);

  return (
    <Card>
      <SectionHeader
        title="Mon argent"
        subtitle="Ce qu'il y a sur tes comptes aujourd'hui"
        aside={
          <Link
            href="/parametres#mes-comptes"
            className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-full pl-3 pr-1.5 text-sm font-semibold text-blush-700 transition-colors hover:bg-blush-50"
          >
            Mes comptes
            <ChevronRight size={16} aria-hidden />
          </Link>
        }
      />
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-canvas px-4 py-3">
          <dt className="text-[13px] font-medium text-ink-soft">Sur tes comptes</dt>
          <dd className="mt-0.5">
            <Money value={onAccounts} cents="always" className="tabular text-lg font-semibold tracking-tight" />
            <span className="block text-[12px] text-muted">Courant, joint, espèces</span>
          </dd>
        </div>
        <div className="rounded-2xl bg-sage-50 px-4 py-3">
          <dt className="text-[13px] font-medium text-ink-soft">Épargne</dt>
          <dd className="mt-0.5">
            <Money value={savings} cents="always" className="tabular text-lg font-semibold tracking-tight" />
            <span className="block text-[12px] text-muted">Mise de côté, pas à dépenser</span>
          </dd>
        </div>
        <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-4 border-t border-line px-1 pt-3">
          <dt className="text-[14px] text-ink-soft">
            Tout ton argent <span className="text-[12px] text-muted">(comptes + épargne)</span>
          </dt>
          <dd>
            <Money value={total} cents="always" className="tabular text-[15px] font-semibold" />
          </dd>
        </div>
      </dl>
    </Card>
  );
}
