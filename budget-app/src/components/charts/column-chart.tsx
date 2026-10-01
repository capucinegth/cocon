"use client";

import { useState } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatAxis, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { columnPath, niceStep, ticksBetween } from "./scale";

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
  /** Période en cours (incomplète) : affichée plus claire, avec une mention. */
  partial?: boolean;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  title: string;
  height?: number;
}

const PAD = { top: 28, right: 4, bottom: 44, left: 48 };
const MAX_BAR = 24;

/** Histogramme une seule teinte. Survol / toucher / focus : la valeur s'affiche sur la colonne. */
export function ColumnChart({ data, title, height = 240 }: ColumnChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const defaultKey = data.at(-1)?.key ?? "";
  const [activeKey, setActiveKey] = useState(defaultKey);

  const step = niceStep(Math.max(...data.map((d) => d.value)) / 4);
  const top = Math.ceil(Math.max(...data.map((d) => d.value)) / step) * step;
  const ticks = ticksBetween(0, top, step);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(MAX_BAR, band * 0.5);
  const y = (value: number) => PAD.top + plotH * (1 - value / top);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={title} onMouseLeave={() => setActiveKey(defaultKey)}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const active = d.key === activeKey;
            const barY = y(d.value);
            return (
              <g key={d.key}>
                <path
                  d={columnPath(cx - barW / 2, barY, barW, PAD.top + plotH - barY)}
                  className={cn(
                    "transition-[fill] duration-200",
                    d.partial ? (active ? "fill-blush-300" : "fill-blush-200") : active ? "fill-blush-700" : "fill-blush-500",
                  )}
                />
                {active && (
                  <text x={cx} y={barY - 9} textAnchor="middle" className="fill-ink text-[12px] font-semibold">
                    {formatMoney(Math.round(d.value))}
                  </text>
                )}
                <text
                  x={cx}
                  y={PAD.top + plotH + 20}
                  textAnchor="middle"
                  className={cn("text-[12px]", active ? "fill-ink font-semibold" : "fill-muted")}
                >
                  {d.label}
                </text>
                {d.partial && (
                  <text x={cx} y={PAD.top + plotH + 35} textAnchor="middle" className="fill-muted text-[10.5px]">
                    en cours
                  </text>
                )}
                {/* Zone de survol plus large que la colonne */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH + PAD.bottom}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label} : ${formatMoney(d.value)}`}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setActiveKey(d.key)}
                  onFocus={() => setActiveKey(d.key)}
                  onClick={() => setActiveKey(d.key)}
                />
              </g>
            );
          })}
        </svg>
      )}

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
