"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { categoryInfo, deadlineKindLabel } from "@/lib/admin/catalog";
import { deadlineGroupLabels, formatDocDate, groupDeadlines, relativeDue } from "@/lib/admin/documents";
import { useDocuments } from "@/store/documents-store";

/** Prochaines échéances : en retard, 7 jours, 30 jours, 60 jours, plus tard. */
export function DeadlinesScreen() {
  const { deadlines, documents, today, openSheet } = useDocuments();
  const groups = groupDeadlines(deadlines, today);
  const docOf = (id: string) => documents.find((d) => d.id === id);

  return (
    <>
      <PageHeader title="Échéances" subtitle="Ce qui arrive bientôt dans tes papiers">
        <Link href="/administratif" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-blush-700 hover:bg-blush-50">
          <ArrowLeft size={16} aria-hidden />
          Mes papiers
        </Link>
      </PageHeader>

      {groups.length === 0 ? (
        <Card>
          <EmptyState emoji="🌿" title="Aucune échéance à venir">
            Ajoute une échéance depuis un document (fin de contrat, date limite, renouvellement…).
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`groupe-${group.id}`}>
              <h2 id={`groupe-${group.id}`} className="mb-2 px-1 text-sm font-semibold text-muted">
                {deadlineGroupLabels[group.id]}
              </h2>
              <Card padded={false} className="p-2">
                <ul>
                  {group.items.map((deadline) => {
                    const doc = docOf(deadline.documentId);
                    const category = doc ? categoryInfo(doc.category) : undefined;
                    return (
                      <li key={deadline.id}>
                        <button
                          type="button"
                          onClick={() => openSheet({ type: "document", documentId: deadline.documentId })}
                          className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-blush-50/70"
                        >
                          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-peach-50">
                            <CalendarClock size={18} className="text-peach-700" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-[15px] font-semibold">{deadline.label}</span>
                            <span className="block break-words text-[13px] text-muted">
                              {formatDocDate(deadline.dueDate)} · {deadlineKindLabel(deadline.kind)}
                              {doc ? ` · ${category?.emoji} ${doc.title}` : ""}
                            </span>
                          </span>
                          <StatusPill status={group.id === "late" ? "over" : group.id === "week" ? "warning" : "scheduled"}>{relativeDue(deadline.dueDate, today)}</StatusPill>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
