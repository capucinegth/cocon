import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

interface StatCardProps {
  label: string;
  /** Valeur déjà mise en forme (idéalement un <Money />). */
  value: ReactNode;
  caption?: ReactNode;
  tone: Tone;
  icon: LucideIcon;
  /** « compact » : pour trois cartes côte à côte sur mobile. */
  size?: "compact" | "regular";
  className?: string;
}

/** Petite carte chiffre clé, légèrement teintée selon le type d'information. */
export function StatCard({ label, value, caption, tone, icon: Icon, size = "regular", className }: StatCardProps) {
  const styles = toneStyles[tone];
  const compact = size === "compact";
  return (
    <div className={cn("flex min-w-0 flex-col rounded-card", styles.surface, compact ? "gap-2.5 p-3.5 sm:p-4" : "gap-3 p-5", className)}>
      <span className={cn("grid shrink-0 place-items-center bg-surface/85", compact ? "size-9 rounded-xl" : "size-11 rounded-2xl")}>
        <Icon size={compact ? 17 : 20} strokeWidth={1.9} className={styles.text} aria-hidden />
      </span>
      <div className={cn("min-w-0", compact && "mt-auto")}>
        <p className={cn("font-medium leading-snug text-ink-soft", compact ? "text-[13px]" : "text-sm")}>{label}</p>
        <p className={cn("mt-0.5 font-semibold leading-tight tracking-tight", compact ? "text-[17px] sm:text-[20px]" : "text-[22px]")}>
          {value}
        </p>
        {caption && <p className="mt-1 text-[13px] leading-snug text-ink-soft">{caption}</p>}
      </div>
    </div>
  );
}
