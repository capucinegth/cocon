"use client";

import { FilePlus2 } from "lucide-react";
import { useDocuments } from "@/store/documents-store";

/** Dans « Mes papiers », le bouton flottant (mobile et tablette) ajoute un document. */
export function AdminFab() {
  const { openSheet, status } = useDocuments();
  if (status !== "ready") return null;
  return (
    <button
      type="button"
      onClick={() => openSheet({ type: "import" })}
      className="fixed right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-ink pl-5 pr-6 text-[15px] font-semibold text-white shadow-float transition-all duration-200 hover:bg-ink/90 active:scale-95 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] lg:hidden"
    >
      <FilePlus2 size={20} strokeWidth={2.2} aria-hidden />
      Ajouter un document
    </button>
  );
}
