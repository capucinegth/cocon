"use client";

import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBudget } from "@/store/budget-store";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-card bg-blush-50/80 ${className}`} />;
}

/** Chargement (squelette doux), erreur (avec « Réessayer »), sinon la page. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, loadError, reload } = useBudget();

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="pt-7 lg:pt-11">
        <span className="sr-only">Chargement de tes données…</span>
        <div aria-hidden className="flex flex-col gap-4 sm:gap-5">
          <div className="h-9 w-48 animate-pulse rounded-full bg-blush-50" />
          <Block className="h-72" />
          <div className="grid grid-cols-3 gap-3">
            <Block className="h-24" />
            <Block className="h-24" />
            <Block className="h-24" />
          </div>
          <Block className="h-48" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="pt-10 lg:pt-16">
        <div role="alert" className="card mx-auto flex max-w-md flex-col items-center px-6 py-10 text-center">
          <span aria-hidden className="grid size-14 place-items-center rounded-full bg-blush-50 text-2xl">
            🌧️
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Tes données n&apos;ont pas pu être chargées</h1>
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
