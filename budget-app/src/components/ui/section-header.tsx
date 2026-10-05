import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Lien « Voir tout » optionnel. */
  href?: string;
  linkLabel?: string;
  /** Contenu libre à droite (montant, bouton…). */
  aside?: ReactNode;
}

export function SectionHeader({ title, subtitle, href, linkLabel = "Voir tout", aside }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {href ? (
        <Link
          href={href}
          className="-mr-2 inline-flex h-10 shrink-0 items-center rounded-full pl-3 pr-1.5 text-sm font-semibold text-blush-700 transition-colors hover:bg-blush-50"
        >
          {linkLabel}
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : (
        aside
      )}
    </div>
  );
}
