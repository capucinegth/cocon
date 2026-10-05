"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  /** Classe de trait SVG (ex. « stroke-sage-500 »). */
  strokeClass: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Total représenté par l'anneau complet ; la part non couverte reste sur le rail. */
  total: number;
  title: string;
  size?: number;
  thickness?: number;
  trackClass?: string;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** Contenu affiché au centre. */
  children?: ReactNode;
}

const GAP = 2;

/** Anneau de répartition : segments séparés par un fin espace, rail = part restante. */
export function DonutChart({
  segments,
  total,
  title,
  size = 224,
  thickness = 22,
  trackClass = "stroke-blush-50",
  activeId,
  onActiveChange,
  children,
}: DonutChartProps) {
  const radius = (size - thickness) / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<{ items: (DonutSegment & { start: number; length: number })[]; offset: number }>(
    ({ items, offset }, segment) => {
      const length = total > 0 ? (segment.value / total) * circumference : 0;
      return { items: [...items, { ...segment, start: offset, length }], offset: offset + length };
    },
    { items: [], offset: 0 },
  ).items;

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label={title} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={thickness} className={trackClass} />
        {arcs.map((arc) => {
          const visible = Math.max(arc.length - GAP, 0);
          const active = activeId === arc.id;
          return (
            <circle
              key={arc.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={active ? thickness + 6 : thickness}
              strokeDasharray={`${visible} ${circumference}`}
              strokeDashoffset={-arc.start}
              tabIndex={0}
              role="button"
              aria-label={arc.label}
              className={cn(
                "arc-draw cursor-pointer outline-none transition-[stroke-width,opacity] duration-300",
                arc.strokeClass,
                activeId && !active && "opacity-45",
              )}
              style={{ ["--arc-c" as string]: `${circumference}px` }}
              onMouseEnter={() => onActiveChange(arc.id)}
              onMouseLeave={() => onActiveChange(null)}
              onFocus={() => onActiveChange(arc.id)}
              onBlur={() => onActiveChange(null)}
              onClick={() => onActiveChange(active ? null : arc.id)}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
