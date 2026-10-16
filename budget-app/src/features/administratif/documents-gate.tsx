"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDocuments } from "@/store/documents-store";

/** Chargement (squelette doux) ou erreur (avec « Réessayer ») des documents, sinon la page. */
export function DocumentsGate({ children }: { children: ReactNode }) {
  const { status, loadError, reload } = useDocuments();
  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="pt-7 lg:pt-11">
        <span className="sr-only">Chargement de tes documents…</span>
        <div aria-hidden className="flex flex-col gap-4">
          <div className="h-9 w-44 animate-pulse rounded-full bg-blush-50" />
          <div className="h-40 animate-pulse rounded-card bg-blush-50/80" />
          <div className="h-56 animate-pulse rounded-card bg-blush-50/80" />
        </div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="pt-10 lg:pt-16">
        <div role="alert" className="card mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-blush-50 text-2xl">
            🗂️
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Tes documents n&apos;ont pas pu être chargés</h1>
          <p className="mt-2 text-[15px] text-muted">{loadError}</p>
          <Button onClick={() => void reload()} className="mt-6">
            <RefreshCw size={17} aria-hidden />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
  return children;
}
