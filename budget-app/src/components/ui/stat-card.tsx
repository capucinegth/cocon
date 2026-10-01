import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

interface StatCardProps {
  label: string;
  value: string;
  caption?: ReactNode;
  tone: Tone;
  icon: LucideIcon;
  /** Icône à gauche même sur mobile (carte pleine largeur). */
  wide?: boolean;
  className?: string;
}

/** Petite carte chiffre clé, teintée selon le type d'information. */
export function StatCard({ label, value, caption, tone, icon: Icon, wide, className }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        "flex rounded-card p-5",
        styles.surface,
        wide ? "items-center gap-4" : "flex-col gap-3 lg:flex-row lg:items-center lg:gap-4",
        className,
      )}
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl bg-surface/80")}>
        <Icon size={20} strokeWidth={1.9} className={styles.text} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight">{value}</p>
        {caption && <p className="mt-1 text-[13px] leading-snug text-muted">{caption}</p>}
      </div>
    </div>
  );
}
