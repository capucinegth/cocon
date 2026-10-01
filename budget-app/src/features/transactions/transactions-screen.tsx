"use client";

import { ArrowDownLeft, ArrowUpRight, Plus, Search } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { getCategory } from "@/config/categories";
import { groupByDay, upcomingOfMonth } from "@/lib/budget";
import { formatDayHeading, formatMonth, formatShortDate } from "@/lib/dates";
import { formatMoney, roundCents } from "@/lib/format";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { TransactionKind } from "@/types/finance";
import { TransactionRow } from "./transaction-row";

type Filter = "all" | TransactionKind;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "expense", label: "Dépenses" },
  { value: "income", label: "Revenus" },
  { value: "saving", label: "Épargne" },
];

/** Recherche insensible à la casse et aux accents. */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function TransactionsScreen() {
  const data = useBudget();
  const { openAdd } = useUI();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const q = normalize(query.trim());
  const matches = (label: string, categoryLabel: string) =>
    !q || normalize(label).includes(q) || normalize(categoryLabel).includes(q);

  const visible = data.transactions.filter(
    (t) => (filter === "all" || t.kind === filter) && matches(t.label, getCategory(t.categoryId).label),
  );
  const groups = groupByDay(visible);
  const upcoming = upcomingOfMonth(data).filter(
    (u) => (filter === "all" || filter === "expense") && matches(u.label, getCategory(u.categoryId).label),
  );

  const incoming = roundCents(data.transactions.filter((t) => t.kind === "income").reduce((acc, t) => acc + t.amount, 0));
  const outgoing = roundCents(data.transactions.filter((t) => t.kind !== "income").reduce((acc, t) => acc + t.amount, 0));

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={formatMonth(data.today)}
        actions={
          <div className="hidden lg:block">
            <Button onClick={openAdd}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Ajouter
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Recherche + filtres */}
          <div className="flex animate-rise flex-col gap-3">
            <label className="relative block">
              <span className="sr-only">Rechercher une transaction</span>
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un nom, une catégorie…"
                className="h-12 w-full rounded-full bg-surface pl-11 pr-4 text-[15px] shadow-card outline-none placeholder:text-muted focus:ring-2 focus:ring-blush-300"
              />
            </label>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrer">
              {filters.map((f) => (
                <ChoiceChip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
                  {f.label}
                </ChoiceChip>
              ))}
            </div>
          </div>

          {/* Résumé compact (mobile) */}
          <div className="grid animate-rise grid-cols-2 gap-3 lg:hidden">
            <div className="rounded-3xl bg-sage-50 px-4 py-3">
              <p className="text-[13px] font-medium text-muted">Entrées</p>
              <p className="text-lg font-semibold">{formatMoney(incoming, { sign: "always" })}</p>
            </div>
            <div className="rounded-3xl bg-peach-50 px-4 py-3">
              <p className="text-[13px] font-medium text-muted">Sorties</p>
              <p className="text-lg font-semibold">{formatMoney(-outgoing)}</p>
            </div>
          </div>

          {upcoming.length > 0 && (
            <section className="animate-rise">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted">À venir</h2>
                <span className="tabular text-sm text-muted">
                  {formatMoney(-upcoming.reduce((acc, u) => acc + u.amount, 0))}
                </span>
              </div>
              <Card padded={false} className="p-2">
                <ul>
                  {upcoming.map((u) => (
                    <TransactionRow
                      key={u.id}
                      label={u.label}
                      amount={u.amount}
                      kind="expense"
                      categoryId={u.categoryId}
                      accountId={u.accountId}
                      scheduledLabel={`Prévu le ${formatShortDate(u.date)}`}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {groups.map((group) => (
            <section key={group.date} className="animate-rise">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted">{formatDayHeading(group.date, data.today)}</h2>
                <span className="tabular text-sm text-muted">{formatMoney(group.net, { sign: "always" })}</span>
              </div>
              <Card padded={false} className="p-2">
                <ul>
                  {group.items.map((t) => (
                    <TransactionRow
                      key={t.id}
                      label={t.label}
                      amount={t.amount}
                      kind={t.kind}
                      categoryId={t.categoryId}
                      accountId={t.accountId}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ))}

          {groups.length === 0 && upcoming.length === 0 && (
            <Card className="text-center">
              <p className="text-3xl" aria-hidden>
                🔍
              </p>
              <p className="mt-2 font-semibold">Aucune transaction trouvée</p>
              <p className="mt-1 text-sm text-muted">Essaie un autre mot ou un autre filtre.</p>
            </Card>
          )}
        </div>

        {/* Résumé latéral (desktop) */}
        <aside className="hidden animate-rise flex-col gap-4 lg:sticky lg:top-8 lg:flex">
          <Card>
            <h2 className="text-[17px] font-semibold tracking-tight">Ce mois-ci</h2>
            <dl className="mt-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-sage-50">
                  <ArrowDownLeft size={18} className="text-sage-700" aria-hidden />
                </span>
                <dt className="flex-1 text-[15px] text-muted">Entrées</dt>
                <dd className="tabular font-semibold">{formatMoney(incoming, { sign: "always" })}</dd>
              </div>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-peach-50">
                  <ArrowUpRight size={18} className="text-peach-700" aria-hidden />
                </span>
                <dt className="flex-1 text-[15px] text-muted">Sorties</dt>
                <dd className="tabular font-semibold">{formatMoney(-outgoing)}</dd>
              </div>
            </dl>
            <p className="mt-5 rounded-2xl bg-canvas px-4 py-3 text-[13px] leading-relaxed text-muted">
              {data.transactions.length} opérations ce mois-ci. Les sorties incluent ton virement d&apos;épargne.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
