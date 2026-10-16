"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, FilePlus2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { documentCategories, typeInfo } from "@/lib/admin/catalog";
import { formatDocShortDate, periodLabel, recentDocuments, relativeDue, searchDocuments, summarizeCategory, upcomingDeadlines } from "@/lib/admin/documents";
import { useDocuments } from "@/store/documents-store";
import type { AdminState, DocumentCategory } from "@/types/documents";
import { DocumentRow } from "./document-row";
import { SearchBox } from "./search-box";

/** Une ligne d'aperçu par catégorie : ce qui compte, sans statistiques. */
function categoryLine(state: AdminState, category: DocumentCategory): string {
  const summary = summarizeCategory(state, category);
  if (summary.count === 0) return "Aucun document pour l'instant";
  const parts = [`${summary.count} document${summary.count > 1 ? "s" : ""}`];
  if (summary.nextDeadline) parts.push(`échéance le ${formatDocShortDate(summary.nextDeadline.dueDate, state.today)}`);
  else if (summary.latest) parts.push(`dernier : ${periodLabel(summary.latest).toLowerCase() || typeInfo(summary.latest.type, category).label.toLowerCase()}`);
  return parts.join(" · ");
}

/** « Mes papiers » : à faire, mes documents (4 catégories), ajouts récents. Pas de tableau de bord chiffré. */
export function AdminHome() {
  const state = useDocuments();
  const { documents, fields, deadlines, today, openSheet } = state;
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim() ? searchDocuments(state, query) : []), [state, query]);
  // À vérifier : classement proposé non confirmé, ou information proposée non validée.
  const proposedDocIds = new Set(fields.filter((f) => f.status === "propose").map((f) => f.documentId));
  const needsReview = (id: string) => proposedDocIds.has(id) || documents.some((d) => d.id === id && d.classificationStatus === "a_verifier");
  const toReview = documents.filter((d) => needsReview(d.id));
  const soon = upcomingDeadlines(deadlines, today);
  // Les ajouts récents ne répètent pas ce qui est déjà dans « À faire ».
  const reviewIds = new Set(toReview.map((d) => d.id));
  const recent = recentDocuments(documents.filter((d) => !reviewIds.has(d.id)));
  const titleOf = (id: string) => documents.find((d) => d.id === id)?.title ?? "";
  const open = (documentId: string) => openSheet({ type: "document", documentId });

  return (
    <>
      <PageHeader
        title="Mes papiers"
        subtitle="Tes documents administratifs, rangés et à portée de main"
        actions={
          <div className="hidden lg:block">
            <Button onClick={() => openSheet({ type: "import" })}>
              <FilePlus2 size={18} aria-hidden />
              Ajouter un document
            </Button>
          </div>
        }
      >
        <SearchBox value={query} onChange={setQuery} placeholder="Rechercher : salaire, 2026, mutuelle…" />
      </PageHeader>

      {query.trim() ? (
        <Card aria-live="polite">
          <SectionHeader title="Résultats" subtitle={`${results.length} document${results.length > 1 ? "s" : ""}`} />
          {results.length === 0 ? (
            <EmptyState emoji="🔍" title="Rien trouvé" className="py-4">
              Essaie un autre mot : un type (« fiche de paie »), une année, un organisme…
            </EmptyState>
          ) : (
            <ul className="-mx-3 -my-1">
              {results.map((doc) => (
                <DocumentRow key={doc.id} document={doc} toReview={needsReview(doc.id)} onOpen={() => open(doc.id)} />
              ))}
            </ul>
          )}
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState emoji="🗂️" title="Range ici tes papiers" className="py-6">
            <span className="block">Fiches de paie, mutuelle, avis d&apos;impôt, contrats d&apos;assurance : photographie-les ou importe-les, Cocon les classe avec toi.</span>
            <Button onClick={() => openSheet({ type: "import" })} className="mt-5">
              <FilePlus2 size={18} aria-hidden />
              Ajouter un document
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-12 lg:items-start">
          <div className="flex flex-col gap-4 sm:gap-5 max-lg:contents lg:col-span-7">
            {(toReview.length > 0 || soon.length > 0) && (
              <Card className="order-1">
                <SectionHeader
                  title="À faire"
                  aside={
                    <Link href="/administratif/echeances" className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-full pl-3 pr-1.5 text-sm font-semibold text-blush-700 hover:bg-blush-50">
                      Échéances
                      <ChevronRight size={16} aria-hidden />
                    </Link>
                  }
                />
                <ul className="-mx-3 -my-1">
                  {soon.map((deadline) => (
                    <li key={deadline.id}>
                      <button type="button" onClick={() => open(deadline.documentId)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-blush-50/70">
                        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-peach-50">
                          <CalendarClock size={18} className="text-peach-700" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[15px] font-semibold">{deadline.label}</span>
                          <span className="block break-words text-[13px] text-muted">
                            {formatDocShortDate(deadline.dueDate, today)} · {titleOf(deadline.documentId)}
                          </span>
                        </span>
                        <StatusPill status={deadline.dueDate < today ? "over" : "scheduled"}>{relativeDue(deadline.dueDate, today)}</StatusPill>
                      </button>
                    </li>
                  ))}
                  {toReview.map((doc) => (
                    <DocumentRow key={doc.id} document={doc} toReview onOpen={() => open(doc.id)} />
                  ))}
                </ul>
              </Card>
            )}

            <section aria-labelledby="mes-documents" className="order-2">
              <h2 id="mes-documents" className="mb-3 px-1 text-[17px] font-semibold tracking-tight">
                Mes documents
              </h2>
              <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                {documentCategories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/administratif/${category.id}`} className="lift flex h-full min-h-24 items-center gap-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-ink/[0.04]">
                      <CategoryBadge emoji={category.emoji} tone={category.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold">{category.label}</span>
                        <span className="block break-words text-[13px] text-muted">{categoryLine(state, category.id)}</span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {recent.length > 0 && (
            <div className="flex flex-col gap-4 sm:gap-5 max-lg:contents lg:col-span-5">
              <Card className="order-3">
                <SectionHeader title="Ajouts récents" />
                <ul className="-mx-3 -my-1">
                  {recent.map((doc) => (
                    <DocumentRow key={doc.id} document={doc} onOpen={() => open(doc.id)} />
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
