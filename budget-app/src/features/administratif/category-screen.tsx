"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, FilePlus2, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectPill } from "@/components/ui/select-pill";
import { categoryInfo, typesOf } from "@/lib/admin/catalog";
import { documentYear, searchDocuments } from "@/lib/admin/documents";
import { useDocuments } from "@/store/documents-store";
import type { DocumentCategory } from "@/types/documents";
import { DocumentRow } from "./document-row";
import { SearchBox } from "./search-box";

/** Documents d'une catégorie : recherche, filtres (type, année, à vérifier), liste. */
export function CategoryScreen({ category }: { category: DocumentCategory }) {
  const state = useDocuments();
  const { fields, openSheet } = state;
  const info = categoryInfo(category);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const [onlyReview, setOnlyReview] = useState(false);

  const all = useMemo(() => state.documents.filter((d) => d.category === category), [state.documents, category]);
  const proposed = new Set(fields.filter((f) => f.status === "propose").map((f) => f.documentId));
  const needsReview = (id: string) => proposed.has(id) || all.some((d) => d.id === id && d.classificationStatus === "a_verifier");
  const years = [...new Set(all.map(documentYear))].sort((a, b) => b - a);
  const visible = searchDocuments({ documents: all, fields }, query).filter(
    (d) => (type === "all" || d.type === type) && (year === "all" || documentYear(d) === Number(year)) && (!onlyReview || needsReview(d.id)),
  );
  const filtersActive = type !== "all" || year !== "all" || onlyReview || query.trim() !== "";

  return (
    <>
      <PageHeader
        title={`${info.emoji} ${info.label}`}
        subtitle={info.hint}
        actions={
          <div className="hidden lg:block">
            <Button onClick={() => openSheet({ type: "import" })}>
              <FilePlus2 size={18} aria-hidden />
              Ajouter un document
            </Button>
          </div>
        }
      >
        <Link href="/administratif" className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-blush-700 hover:bg-blush-50">
          <ArrowLeft size={16} aria-hidden />
          Mes papiers
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder={`Rechercher dans ${info.label.toLowerCase()}…`} />
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <SelectPill
            label="Type de document"
            icon={Tag}
            value={type}
            onChange={setType}
            options={[{ value: "all", label: "Tous les types" }, ...typesOf(category).map((t) => ({ value: t.id, label: t.label }))]}
            active={type !== "all"}
          />
          <SelectPill
            label="Année"
            icon={CalendarDays}
            value={year}
            onChange={setYear}
            options={[{ value: "all", label: "Toutes les années" }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
            active={year !== "all"}
          />
          <ChoiceChip selected={onlyReview} onClick={() => setOnlyReview((v) => !v)} className="justify-self-start">
            À vérifier
          </ChoiceChip>
        </div>
        <p className="min-h-6 px-1 text-sm text-muted" aria-live="polite">
          {visible.length} document{visible.length > 1 ? "s" : ""}
        </p>
      </div>

      <Card padded={false} className="mt-2 p-2">
        {visible.length === 0 ? (
          <EmptyState emoji={filtersActive ? "🔍" : info.emoji} title={filtersActive ? "Rien trouvé" : `Aucun document ${info.label.toLowerCase() === "santé" ? "de santé" : `dans ${info.label.toLowerCase()}`}`}>
            {filtersActive ? (
              "Essaie un autre mot, un autre type ou une autre année."
            ) : (
              <>
                <span className="block">Ajoute ton premier document : une photo suffit.</span>
                <Button variant="soft" size="sm" onClick={() => openSheet({ type: "import" })} className="mt-4">
                  <FilePlus2 size={16} aria-hidden />
                  Ajouter un document
                </Button>
              </>
            )}
          </EmptyState>
        ) : (
          <ul>
            {visible.map((doc) => (
              <DocumentRow key={doc.id} document={doc} toReview={needsReview(doc.id)} onOpen={() => openSheet({ type: "document", documentId: doc.id })} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
