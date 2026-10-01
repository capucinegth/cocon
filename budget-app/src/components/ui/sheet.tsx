"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Feuille modale : glisse depuis le bas sur mobile, fenêtre centrée sur ordinateur.
 * Basée sur <dialog> (focus piégé, touche Échap, couche supérieure natifs).
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-ink/10 sm:hidden" aria-hidden />
        <header className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4 sm:pt-6">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-2 grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-blush-50 hover:text-ink"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </dialog>
  );
}
