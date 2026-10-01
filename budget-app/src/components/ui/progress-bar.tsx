import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

interface ProgressBarProps {
  /** Part réalisée, de 0 à 1 (au-delà, la barre est pleine). */
  value: number;
  /** Part prévue mais pas encore passée (affichée plus légère). */
  pending?: number;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  label: string;
  className?: string;
}

const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" };

const clamp = (n: number) => Math.min(Math.max(n, 0), 1);

/** Barre de progression pastel, animée à l'apparition. */
export function ProgressBar({ value, pending = 0, tone = "blush", size = "md", label, className }: ProgressBarProps) {
  const styles = toneStyles[tone];
  const done = clamp(value);
  const planned = clamp(Math.min(pending, 1 - done));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(value + pending) * 100)}
      className={cn("flex w-full gap-[2px] overflow-hidden rounded-full", heights[size], styles.track, className)}
    >
      {done > 0 && (
        <div
          className={cn("h-full shrink-0 origin-left animate-grow rounded-full", styles.fill)}
          style={{ width: `${done * 100}%` }}
        />
      )}
      {planned > 0 && (
        <div
          className={cn("h-full shrink-0 origin-left animate-grow rounded-full opacity-45", styles.fill)}
          style={{ width: `calc(${planned * 100}% - 2px)`, animationDelay: "150ms" }}
        />
      )}
    </div>
  );
}
