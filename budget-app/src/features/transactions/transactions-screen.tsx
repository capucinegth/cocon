"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, Plus, Search, Sprout, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionRow } from "@/components/finance/transaction-row";
import { CalendarCard } from "./calendar-card";
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

  // Reçu / dépensé du mois ; l'épargne (transfert vers un compte d'épargne) est montrée à part, pas comme une dépense.
  const incoming = total(ofMonth.filter((t) => t.kind === "income").map((t) => t.amount));
  const spent = total(ofMonth.filter((t) => t.kind === "expense").map((t) => t.amount));
  const savedThisMonth = total(ofMonth.filter((t) => t.kind === "saving").map((t) => t.amount));
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
        title="Dépenses et revenus"
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
              <span className="sr-only">Rechercher une dépense ou un revenu</span>
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
          <div className="animate-rise xl:hidden">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-sage-50 px-4 py-3">
                <p className="text-[13px] font-medium text-ink-soft">Reçu</p>
                <Money value={incoming} sign="always" className="text-lg font-semibold" />
              </div>
              <div className="rounded-3xl bg-peach-50 px-4 py-3">
                <p className="text-[13px] font-medium text-ink-soft">Dépensé</p>
                <Money value={-spent} className="text-lg font-semibold" />
              </div>
            </div>
            {savedThisMonth > 0 && (
              <p className="mt-2 px-1 text-[13px] text-muted">
                Et <Money value={savedThisMonth} /> mis de côté sur ton épargne.
              </p>
            )}
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
                        subtitle={[
                          goal ? `Épargne · ${goal.label}` : category.label,
                          t.accountId !== defaultAccount ? findAccount(data.accounts, t.accountId).label : null,
                          t.kind === "saving" && t.transferAccountId ? `→ ${findAccount(data.accounts, t.transferAccountId).label}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
                <EmptyState emoji="🔍" title="Rien trouvé">
                  Essaie un autre mot, un autre mois ou une autre catégorie.
                </EmptyState>
              ) : (
                <EmptyState emoji="🧾" title="Rien ce mois-ci">
                  <span className="block">Ajoute ta première dépense ou ton premier revenu : tout se met à jour automatiquement.</span>
                  <Button variant="soft" size="sm" onClick={() => openAdd()} className="mt-4">
                    <Plus size={16} strokeWidth={2.4} aria-hidden />
                    Ajouter une dépense ou un revenu
                  </Button>
                </EmptyState>
              )}
            </Card>
          )}
          <details className="group animate-rise xl:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-full bg-surface px-5 text-[15px] font-semibold shadow-card ring-1 ring-ink/5 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <CalendarDays size={18} className="text-muted" aria-hidden />
                Voir le mois en calendrier
              </span>
              <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3">
              <CalendarCard key={month} month={month} />
            </div>
          </details>
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
                  Reçu
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
                  Dépensé
                </dt>
                <dd>
                  <Money value={-spent} className="tabular font-semibold" />
                </dd>
              </div>
              {savedThisMonth > 0 && (
                <div className="flex items-center gap-3">
                  <dt className="flex flex-1 items-center gap-3 text-[15px] text-muted">
                    <span className="grid size-10 place-items-center rounded-2xl bg-lilac-50">
                      <Sprout size={18} className="text-lilac-700" aria-hidden />
                    </span>
                    Mis de côté
                  </dt>
                  <dd>
                    <Money value={savedThisMonth} className="tabular font-semibold" />
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-5 rounded-2xl bg-canvas px-4 py-3 text-[13px] leading-relaxed text-muted">
              Touche une ligne pour voir le détail ou la modifier.
            </p>
          </Card>
          <CalendarCard key={month} month={month} />
        </aside>
      </div>
    </>
  );
}
