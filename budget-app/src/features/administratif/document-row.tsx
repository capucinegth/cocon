"use client";

import { ChevronRight } from "lucide-react";
import { CategoryBadge } from "@/components/ui/category-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { categoryInfo, typeInfo } from "@/lib/admin/catalog";
import { formatDocDate, periodLabel } from "@/lib/admin/documents";
import type { AdminDocument } from "@/types/documents";

/** Ligne d'un document : catégorie, titre, type et période ; « À vérifier » si besoin. */
export function DocumentRow({ document, toReview, onOpen }: { document: AdminDocument; toReview?: boolean; onOpen: () => void }) {
  const category = categoryInfo(document.category);
  const when = periodLabel(document) || (document.documentDate ? formatDocDate(document.documentDate) : "");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-blush-50/70 active:bg-blush-50"
      >
        <CategoryBadge emoji={category.emoji} tone={category.tone} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-semibold">{document.title}</span>
          <span className="block break-words text-[13px] text-muted">{[typeInfo(document.type, document.category).label, when].filter(Boolean).join(" · ")}</span>
        </span>
        {toReview && <StatusPill status="warning">À vérifier</StatusPill>}
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
      </button>
    </li>
  );
}
