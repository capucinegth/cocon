import Link from "next/link";
import { Settings } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Raccourci Paramètres (mobile) — masqué sur la page Paramètres elle-même. */
  showSettings?: boolean;
}

export function PageHeader({ title, subtitle, actions, showSettings = true }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 pb-6 pt-8 lg:pb-8 lg:pt-12">
      <div className="min-w-0 animate-rise">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight lg:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] font-medium text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-1">
        {actions}
        {showSettings && (
          <Link
            href="/parametres"
            aria-label="Paramètres"
            className="grid size-11 place-items-center rounded-full bg-surface text-ink shadow-card transition-transform active:scale-95 lg:hidden"
          >
            <Settings size={20} strokeWidth={1.9} aria-hidden />
          </Link>
        )}
      </div>
    </header>
  );
}
