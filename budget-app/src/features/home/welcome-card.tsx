"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { useUI } from "@/store/ui-store";

/** Premier pas d'un nouveau compte : rien n'est encore saisi. */
export function WelcomeCard({ name }: { name?: string }) {
  const { openAdd } = useUI();
  return (
    <section
      aria-labelledby="welcome-title"
      className="relative overflow-hidden rounded-hero bg-linear-to-br from-sage-50 via-surface to-blush-50 p-6 shadow-card ring-1 ring-ink/[0.04] sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-sage-100/70 blur-3xl" />
      <div className="relative">
        <p aria-hidden className="text-3xl">
          🌱
        </p>
        <h2 id="welcome-title" className="mt-3 text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">
          Bienvenue dans Cocon{name ? `, ${name}` : ""}
        </h2>
        <p className="mt-2 max-w-md text-[15px] text-ink-soft">Commence par ajouter ton premier revenu ou ta première dépense.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => openAdd()}>
            <Plus size={18} strokeWidth={2.4} aria-hidden />
            Ajouter une opération
          </Button>
          <Link href="/budget" className={buttonStyles({ variant: "white" })}>
            Préparer mon budget
          </Link>
        </div>
      </div>
    </section>
  );
}
