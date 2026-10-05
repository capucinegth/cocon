"use client";

import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useUI } from "@/store/ui-store";

/** Bouton « + Ajouter » toujours à portée de pouce — mobile et tablette. */
export function AddFab() {
  const pathname = usePathname();
  const { openAdd } = useUI();

  if (pathname.startsWith("/parametres")) return null;

  return (
    <button
      type="button"
      onClick={() => openAdd()}
      className="fixed right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-ink pl-5 pr-6 text-[15px] font-semibold text-white shadow-float transition-all duration-200 hover:bg-ink/90 active:scale-95 bottom-[calc(max(env(safe-area-inset-bottom),12px)+84px)] lg:hidden"
    >
      <Plus size={20} strokeWidth={2.4} aria-hidden />
      Ajouter
    </button>
  );
}
