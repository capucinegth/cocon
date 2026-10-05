import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand";
import { appConfig } from "@/config/app";

/** Carte des pages d'accès : logo, titre, contenu, pied de page. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="animate-rise">
      <Link href="/" className="mx-auto mb-6 flex w-fit items-center gap-3 rounded-2xl px-2 py-1" aria-label={`${appConfig.name}, accueil`}>
        <BrandMark size={44} />
        <span className="text-xl font-semibold tracking-tight">{appConfig.name}</span>
      </Link>
      <section aria-labelledby="auth-title" className="card px-6 py-8 sm:px-8">
        <h1 id="auth-title" className="text-[26px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </section>
      {footer && <div className="mt-5 text-center text-[15px] text-ink-soft">{footer}</div>}
    </div>
  );
}

/** Message d'information (session expirée, déconnexion, e-mail envoyé…). */
export function AuthNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" }) {
  return (
    <p role="status" className={tone === "success" ? "mb-5 rounded-2xl bg-sage-50 px-4 py-3 text-[14px] text-ink" : "mb-5 rounded-2xl bg-lilac-50 px-4 py-3 text-[14px] text-ink"}>
      {children}
    </p>
  );
}
