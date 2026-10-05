"use client";

import { useState } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/cn";
import { formatAxis, formatMoney } from "@/lib/format";
import { columnPath, niceStep, ticksBetween } from "./scale";

export interface ColumnDatum {
  key: string;
  /** Libellé court de l'axe (« Sept. », « 13 »). */
  label: string;
  /** Libellé complet pour la lecture et les lecteurs d'écran. */
  longLabel?: string;
  value: number;
  /** Part prévue, empilée au-dessus en plus clair. */
  planned?: number;
  /** Période en cours (incomplète) : affichée plus claire, avec une mention. */
  partial?: boolean;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  title: string;
  height?: number;
  /** N'afficher qu'un libellé d'axe sur `labelEvery`. */
  labelEvery?: number;
  /** Ligne de repère (ex. budget par jour). */
  reference?: { value: number; label: string };
  /** Colonne mise en avant par défaut. */
  defaultKey?: string;
  /** Affiche « libellé · valeur » au-dessus du graphique pour la colonne active. */
  readout?: boolean;
}

const PAD = { top: 28, right: 4, bottom: 40, left: 48 };
const MAX_BAR = 24;

/** Histogramme une seule teinte. Survol / toucher / focus : la valeur s'affiche. */
export function ColumnChart({ data, title, height = 240, labelEvery = 1, reference, defaultKey, readout }: ColumnChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const initialKey = defaultKey ?? data.at(-1)?.key ?? "";
  const [activeKey, setActiveKey] = useState(initialKey);

  const peak = Math.max(...data.map((d) => d.value + (d.planned ?? 0)), reference?.value ?? 0, 1);
  const step = niceStep(peak / 4);
  const top = Math.ceil(peak / step) * step;
  const ticks = ticksBetween(0, top, step);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(Math.min(MAX_BAR, band * 0.56), 2);
  const y = (value: number) => PAD.top + plotH * (1 - value / top);
  const baseline = PAD.top + plotH;
  const active = data.find((d) => d.key === activeKey);

  return (
    <div>
      {readout && (
        <p className="mb-2 flex h-6 items-baseline gap-2 text-sm" aria-live="polite">
          <span className="text-muted">{active?.longLabel ?? active?.label}</span>
          <span className="font-semibold" data-money>
            {active ? formatMoney(active.value + (active.planned ?? 0)) : ""}
          </span>
          {active?.planned ? <span className="text-muted">dont {formatMoney(active.planned)} prévus</span> : null}
        </p>
      )}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="group" aria-label={title} onMouseLeave={() => setActiveKey(initialKey)}>
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
              const isActive = d.key === activeKey;
              const barY = y(d.value);
              const planned = d.planned ?? 0;
              const plannedY = y(d.value + planned);
              const last = data.length - 1;
              const showLabel = i === last || (i % labelEvery === 0 && last - i >= Math.ceil(labelEvery / 2));
              return (
                <g key={d.key}>
                  {d.value > 0 && (
                    <path
                      d={columnPath(cx - barW / 2, barY, barW, baseline - barY, Math.min(4, barW / 2))}
                      className={cn(
                        "transition-[fill] duration-200",
                        d.partial ? (isActive ? "fill-peach-500" : "fill-peach-300") : isActive ? "fill-peach-700" : "fill-peach-600",
                      )}
                    />
                  )}
                  {planned > 0 && (
                    <path
                      d={columnPath(cx - barW / 2, plannedY, barW, Math.max(barY - plannedY - (d.value > 0 ? 2 : 0), 0), Math.min(4, barW / 2))}
                      className={cn("transition-[fill] duration-200", isActive ? "fill-peach-500" : "fill-peach-300")}
                    />
                  )}
                  {isActive && !readout && d.value + planned > 0 && (
                    <text x={cx} y={plannedY - 9} textAnchor="middle" className="fill-ink text-[12px] font-semibold" data-money>
                      {formatMoney(Math.round(d.value + planned))}
                    </text>
                  )}
                  {showLabel && (
                    <text
                      x={cx}
                      y={baseline + 20}
                      textAnchor="middle"
                      className={cn("text-[12px]", isActive ? "fill-ink font-semibold" : "fill-muted")}
                    >
                      {d.label}
                    </text>
                  )}
                  {d.partial && (
                    <text x={cx} y={baseline + 34} textAnchor="middle" className="fill-muted text-[10.5px]">
                      en cours
                    </text>
                  )}
                  {isActive && readout && (
                    <line x1={cx} x2={cx} y1={PAD.top - 6} y2={baseline} strokeWidth={1} className="stroke-ink/15" />
                  )}
                  {/* Zone de survol plus large que la colonne */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top - 8}
                    width={band}
                    height={plotH + PAD.bottom}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.longLabel ?? d.label} : ${formatMoney(d.value + planned)}`}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setActiveKey(d.key)}
                    onFocus={() => setActiveKey(d.key)}
                    onClick={() => setActiveKey(d.key)}
                  />
                </g>
              );
            })}

            {reference && (
              <g className="pointer-events-none">
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(reference.value)}
                  y2={y(reference.value)}
                  strokeWidth={1.5}
                  className="stroke-ink/35"
                />
              </g>
            )}
          </svg>
        )}

        <table className="sr-only">
          <caption>{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <th scope="row">{d.longLabel ?? d.label}</th>
                <td>{formatMoney(d.value + (d.planned ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
