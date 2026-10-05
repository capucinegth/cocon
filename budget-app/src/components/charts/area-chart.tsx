"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatAxis, formatMoney } from "@/lib/format";
import { monotonePath, niceStep, ticksBetween } from "./scale";

export interface AreaPoint {
  key: string;
  label: string;
  /** Libellé complet pour l'info-bulle. */
  longLabel?: string;
  value: number;
}

interface AreaChartProps {
  data: AreaPoint[];
  title: string;
  height?: number;
  /** Index à partir duquel la courbe devient une prévision (tracé en pointillés). */
  projectedFrom?: number;
  /** N'afficher qu'un libellé d'axe sur `labelEvery`. */
  labelEvery?: number;
}

const PAD = { top: 30, right: 20, bottom: 32, left: 52 };

/** Courbe + léger voile, une seule série. Réticule et info-bulle au survol / toucher. */
export function AreaChart({ data, title, height = 240, projectedFrom, labelEvery = 1 }: AreaChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep(Math.max(max - min, 1) / 4);
  const rawLo = Math.floor((min - step * 0.1) / step) * step;
  const lo = min >= 0 && rawLo < 0 ? 0 : rawLo;
  const rawHi = Math.ceil(max / step) * step;
  const hi = rawHi - max < step * 0.05 ? rawHi + step : rawHi;
  const ticks = ticksBetween(lo, hi, step);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const last = data.length - 1;
  const split = projectedFrom ?? last;
  const x = (i: number) => PAD.left + (last > 0 ? (plotW * i) / last : plotW / 2);
  const y = (value: number) => PAD.top + plotH * (1 - (value - lo) / (hi - lo));

  const points = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const actual = points.slice(0, split + 1);
  const projection = points.slice(split);
  const baseline = PAD.top + plotH;
  const actualLine = monotonePath(actual);
  const area = actual.length > 1 ? `${actualLine}L${actual.at(-1)!.x},${baseline}L${actual[0].x},${baseline}Z` : "";

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActiveIndex(Math.min(Math.max(Math.round(ratio * last), 0), last));
  }

  function handleKey(event: KeyboardEvent<SVGRectElement>) {
    if (event.key === "ArrowRight") setActiveIndex((i) => Math.min((i ?? split) + 1, last));
    if (event.key === "ArrowLeft") setActiveIndex((i) => Math.max((i ?? split) - 1, 0));
  }

  const active = activeIndex !== null ? data[activeIndex] : null;
  const marker = (index: number, label: boolean) => (
    <g key={`m-${index}`}>
      <circle cx={points[index].x} cy={points[index].y} r={4.5} strokeWidth={2} className="fill-sage-500 stroke-surface" />
      {label && (
        <text
          x={points[index].x}
          y={points[index].y - 12}
          textAnchor={index === last ? "end" : index === 0 ? "start" : "middle"}
          className="fill-ink text-[12px] font-semibold"
          data-money
        >
          {formatMoney(Math.round(data[index].value))}
        </text>
      )}
    </g>
  );

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label={title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          <path d={area} className="fill-sage-500/10" />
          <path d={actualLine} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-sage-500" />
          {projection.length > 1 && (
            <path
              d={monotonePath(projection)}
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinecap="round"
              className="stroke-sage-500/60"
            />
          )}

          {data.map((d, i) =>
            i === last || (i % labelEvery === 0 && last - i >= Math.ceil(labelEvery / 2)) ? (
              <text
                key={d.key}
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
                className={activeIndex === i ? "fill-ink text-[12px] font-semibold" : "fill-muted text-[12px]"}
              >
                {d.label}
              </text>
            ) : null,
          )}

          {activeIndex === null ? (
            projectedFrom !== undefined && projectedFrom < last ? (
              [marker(split, true), marker(last, true)]
            ) : (
              marker(last, true)
            )
          ) : (
            <>
              <line
                x1={points[activeIndex].x}
                x2={points[activeIndex].x}
                y1={PAD.top}
                y2={baseline}
                strokeWidth={1}
                className="stroke-ink/15"
              />
              {marker(activeIndex, false)}
            </>
          )}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            role="button"
            aria-label={`${title} — utilise les flèches pour parcourir la courbe`}
            className="cursor-crosshair touch-pan-y outline-none"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(split)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={handleKey}
          />
        </svg>
      )}

      {active && activeIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-2xl bg-surface px-3 py-2 text-center shadow-lift ring-1 ring-ink/5"
          style={{
            left: Math.min(Math.max(points[activeIndex].x, 64), width - 64),
            top: Math.max(points[activeIndex].y - 70, 0),
          }}
        >
          <p className="text-[15px] font-semibold leading-tight" data-money>
            {formatMoney(active.value)}
          </p>
          <p className="whitespace-nowrap text-[12px] text-muted">
            {active.longLabel ?? active.label}
            {projectedFrom !== undefined && activeIndex > projectedFrom ? " · prévision" : ""}
          </p>
        </div>
      )}

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.key}>
              <th scope="row">
                {d.longLabel ?? d.label}
                {projectedFrom !== undefined && i > projectedFrom ? " (prévision)" : ""}
              </th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
