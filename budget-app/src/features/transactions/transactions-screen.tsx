"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarDays, Plus, Search, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionRow } from "@/components/finance/transaction-row";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectPill } from "@/components/ui/select-pill";
import { findAccount } from "@/config/accounts";
import { availableMonths, groupByDay, monthTransactions, monthUpcoming, signedAmount, total, withPlannedMonths } from "@/lib/budget";
import { formatDayHeading, formatMonth, formatShortDate } from "@/lib/dates";
import { normalizeText } from "@/lib/text";
import { useBudget, useCategoryLookup } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";
import type { TransactionKind, UpcomingItem } from "@/types/finance";

type KindFilter = "all" | TransactionKind;

const kindFilters: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "expense", label: "Dépenses" },
  { value: "income", label: "Revenus" },
  { value: "saving", label: "Épargne" },
];

export function TransactionsScreen() {
  const data = useBudget();
  const categoryOf = useCategoryLookup();
  const { openAdd, openTransaction, openRecurring, highlightId } = useUI();
  const [kind, setKind] = useState<KindFilter>("all");
  const [month, setMonth] = useState(data.currentMonth);
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");

  // Mois passés et en cours, plus les mois futurs qui ont des opérations prévues.
  const months = useMemo(() => withPlannedMonths(availableMonths(data), data.allTransactions, data.today), [data]);
  const q = normalizeText(query.trim());
  const matches = (label: string, id: string) =>
    (categoryId === "all" || categoryId === id) &&
    (!q || normalizeText(label).includes(q) || normalizeText(categoryOf(id).label).includes(q));

  const ofMonth = monthTransactions(data, month);
  const visible = ofMonth.filter((t) => (kind === "all" || t.kind === kind) && matches(t.label, t.categoryId));
  const groups = groupByDay(visible);
  const upcoming = monthUpcoming(data, month).filter((u) => (kind === "all" || kind === u.kind) && matches(u.label, u.categoryId));
  const upcomingSigned = (u: UpcomingItem) => (u.kind === "income" ? u.amount : -u.amount);
  const defaultAccount = data.accounts.find((a) => a.type === "checking")?.id;
  const openUpcoming = (u: UpcomingItem) => {
    const planned = u.origin === "planned" ? data.allTransactions.find((t) => t.id === u.id) : undefined;
    if (planned) openTransaction(planned);
    else if (u.recurrenceId) openRecurring(u.recurrenceId);
  };

  const incoming = total(ofMonth.filter((t) => t.kind === "income").map((t) => t.amount));
  const outgoing = total(ofMonth.filter((t) => t.kind !== "income").map((t) => t.amount));
  const filtersActive = kind !== "all" || categoryId !== "all" || q.length > 0;
  const usedCategoryIds = new Set([...ofMonth.map((t) => t.categoryId), ...data.upcoming.map((u) => u.categoryId)]);
  const categoryOptions = [
    { value: "all", label: "Toutes les catégories" },
    ...data.categories
      .filter((c) => usedCategoryIds.has(c.id) || c.id === categoryId)
      .map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}` })),
  ];

  function resetFilters() {
    setKind("all");
    setCategoryId("all");
    setQuery("");
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={formatMonth(month)}
        actions={
          <div className="hidden lg:block">
            <Button onClick={() => openAdd()}>
              <Plus size={18} strokeWidth={2.4} aria-hidden />
              Ajouter
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
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
                className="h-12 w-full rounded-full bg-surface pl-11 pr-4 text-[15px] shadow-card outline-none ring-1 ring-ink/5 focus:ring-2 focus:ring-blush-300"
              />
            </label>
            <SegmentedControl label="Type d'opération" value={kind} onChange={setKind} options={kindFilters} size="sm" className="w-full sm:w-auto" />
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <SelectPill
                label="Mois"
                icon={CalendarDays}
                value={month}
                onChange={setMonth}
                options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
                active={month !== data.currentMonth}
              />
              <SelectPill label="Catégorie" icon={Tag} value={categoryId} onChange={setCategoryId} options={categoryOptions} active={categoryId !== "all"} />
            </div>
          </div>

          {/* Résumé compact (mobile et tablette) */}
          <div className="grid animate-rise grid-cols-2 gap-3 xl:hidden">
            <div className="rounded-3xl bg-sage-50 px-4 py-3">
              <p className="text-[13px] font-medium text-ink-soft">Entrées</p>
              <Money value={incoming} sign="always" className="text-lg font-semibold" />
            </div>
            <div className="rounded-3xl bg-peach-50 px-4 py-3">
              <p className="text-[13px] font-medium text-ink-soft">Sorties</p>
              <Money value={-outgoing} className="text-lg font-semibold" />
            </div>
          </div>

          <div className="flex min-h-9 items-center justify-between gap-3 px-1 text-sm text-muted" aria-live="polite">
            <span>
              {visible.length} opération{visible.length > 1 ? "s" : ""}
              {upcoming.length > 0 && ` · ${upcoming.length} à venir`}
            </span>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center gap-1 rounded-full px-3 font-semibold text-blush-700 transition-colors hover:bg-blush-50"
              >
                <X size={14} aria-hidden />
                Effacer les filtres
              </button>
            )}
          </div>

          {upcoming.length > 0 && (
            <section className="animate-rise">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted">À venir</h2>
                <Money value={total(upcoming.map(upcomingSigned))} sign="always" className="tabular text-sm text-muted" />
              </div>
              <Card padded={false} className="p-2">
                <ul>
                  {upcoming.map((u) => (
                    <TransactionRow
                      key={u.id}
                      label={u.label}
                      category={categoryOf(u.categoryId)}
                      subtitle={`${u.origin === "recurring" ? "Échéance" : "Prévu"} le ${formatShortDate(u.date)} · ${categoryOf(u.categoryId).label}`}
                      amount={upcomingSigned(u)}
                      recurring={u.origin === "recurring" || Boolean(u.recurrenceId)}
                      planned
                      highlighted={u.id === highlightId}
                      onClick={() => openUpcoming(u)}
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
                <Money value={group.net} sign="always" className="tabular text-sm text-muted" />
              </div>
              <Card padded={false} className="p-2">
                <ul>
                  {group.items.map((t) => {
                    const category = categoryOf(t.categoryId);
                    const goal = data.goals.find((g) => g.id === t.goalId);
                    return (
                      <TransactionRow
                        key={t.id}
                        label={t.label}
                        category={category}
                        subtitle={[goal ? `Épargne · ${goal.label}` : category.label, t.accountId !== defaultAccount ? findAccount(data.accounts, t.accountId).label : null].filter(Boolean).join(" · ")}
                        amount={signedAmount(t)}
                        recurring={t.recurrence !== undefined && t.recurrence !== "none"}
                        highlighted={t.id === highlightId}
                        onClick={() => openTransaction(t)}
                      />
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}

          {groups.length === 0 && upcoming.length === 0 && (
            <Card>
              {filtersActive ? (
                <EmptyState emoji="🔍" title="Aucune transaction trouvée">
                  Essaie un autre mot, un autre mois ou une autre catégorie.
                </EmptyState>
              ) : (
                <EmptyState emoji="🧾" title="Aucune opération ce mois-ci">
                  <span className="block">Ajoute ta première dépense ou ton premier revenu : tout se met à jour automatiquement.</span>
                  <Button variant="soft" size="sm" onClick={() => openAdd()} className="mt-4">
                    <Plus size={16} strokeWidth={2.4} aria-hidden />
                    Ajouter une opération
                  </Button>
                </EmptyState>
              )}
            </Card>
          )}
        </div>

        {/* Résumé latéral (desktop) */}
        <aside className="hidden animate-rise flex-col gap-4 xl:sticky xl:top-8 xl:flex">
          <Card>
            <h2 className="text-[17px] font-semibold tracking-tight">{formatMonth(month)}</h2>
            <dl className="mt-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <dt className="flex flex-1 items-center gap-3 text-[15px] text-muted">
                  <span className="grid size-10 place-items-center rounded-2xl bg-sage-50">
                  <ArrowDownLeft size={18} className="text-sage-700" aria-hidden />
                </span>
                  Entrées
                </dt>
                <dd>
                  <Money value={incoming} sign="always" className="tabular font-semibold" />
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="flex flex-1 items-center gap-3 text-[15px] text-muted">
                  <span className="grid size-10 place-items-center rounded-2xl bg-peach-50">
                  <ArrowUpRight size={18} className="text-peach-700" aria-hidden />
                </span>
                  Sorties
                </dt>
                <dd>
                  <Money value={-outgoing} className="tabular font-semibold" />
                </dd>
              </div>
            </dl>
            <p className="mt-5 rounded-2xl bg-canvas px-4 py-3 text-[13px] leading-relaxed text-muted">
              {ofMonth.length} opérations ce mois-ci. Les sorties incluent ton épargne. Touche une ligne pour voir le détail.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
