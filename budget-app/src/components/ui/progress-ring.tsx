import type { ReactNode } from "react";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

interface ProgressRingProps {
  /** De 0 à 1. */
  value: number;
  tone: Tone;
  size?: number;
  strokeWidth?: number;
  label: string;
  children?: ReactNode;
}

/** Anneau de progression (objectifs). Le tracé se dessine à l'apparition. */
export function ProgressRing({ value, tone, size = 84, strokeWidth = 8, label, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 1));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-surface/80" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={cn("ring-draw", toneStyles[tone].stroke)}
          style={{ strokeDashoffset: offset, ["--ring-length" as string]: `${circumference}px` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
