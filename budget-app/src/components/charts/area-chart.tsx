"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatAxis, formatMoney } from "@/lib/format";
import { monotonePath, niceStep, ticksBetween } from "./scale";

export interface AreaPoint {
  key: string;
  label: string;
  value: number;
}

interface AreaChartProps {
  data: AreaPoint[];
  title: string;
  height?: number;
}

const PAD = { top: 28, right: 20, bottom: 32, left: 52 };

/** Courbe + léger voile, une seule série. Réticule et info-bulle au survol / toucher. */
export function AreaChart({ data, title, height = 240 }: AreaChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const values = data.map((d) => d.value);
  const step = niceStep((Math.max(...values) - Math.min(...values)) / 3);
  const lo = Math.floor((Math.min(...values) - step * 0.2) / step) * step;
  const hi = Math.ceil((Math.max(...values) + step * 0.2) / step) * step;
  const ticks = ticksBetween(lo, hi, step);

  const plotW = Math.max(width - PAD.left - PAD.right, 0);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length > 1 ? (plotW * i) / (data.length - 1) : plotW / 2);
  const y = (value: number) => PAD.top + plotH * (1 - (value - lo) / (hi - lo));

  const points = data.map((d, i) => ({ x: x(i), y: y(d.value) }));
  const line = monotonePath(points);
  const baseline = PAD.top + plotH;
  const area = points.length ? `${line}L${points.at(-1)!.x},${baseline}L${points[0].x},${baseline}Z` : "";
  const last = data.length - 1;

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActiveIndex(Math.min(Math.max(Math.round(ratio * last), 0), last));
  }

  function handleKey(event: KeyboardEvent<SVGRectElement>) {
    if (event.key === "ArrowRight") setActiveIndex((i) => Math.min((i ?? last) + 1, last));
    if (event.key === "ArrowLeft") setActiveIndex((i) => Math.max((i ?? last) - 1, 0));
  }

  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={title}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end" className="tabular fill-muted text-[11px]">
                {formatAxis(tick)}
              </text>
            </g>
          ))}

          <path d={area} className="fill-sage-500/10" />
          <path d={line} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-sage-500" />

          {data.map((d, i) => (
            <text
              key={d.key}
              x={x(i)}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
              className={activeIndex === i || (activeIndex === null && i === last) ? "fill-ink text-[12px] font-semibold" : "fill-muted text-[12px]"}
            >
              {d.label}
            </text>
          ))}

          {active === null ? (
            <>
              <circle cx={points[last].x} cy={points[last].y} r={4} strokeWidth={2} className="fill-sage-500 stroke-surface" />
              <text x={points[last].x} y={points[last].y - 14} textAnchor="end" className="fill-ink text-[12px] font-semibold">
                {formatMoney(data[last].value)}
              </text>
            </>
          ) : (
            <>
              <line
                x1={points[activeIndex!].x}
                x2={points[activeIndex!].x}
                y1={PAD.top}
                y2={baseline}
                strokeWidth={1}
                className="stroke-ink/15"
              />
              <circle cx={points[activeIndex!].x} cy={points[activeIndex!].y} r={5} strokeWidth={2} className="fill-sage-500 stroke-surface" />
            </>
          )}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${title} — utilise les flèches pour parcourir les mois`}
            className="cursor-crosshair touch-pan-y outline-none"
            onPointerMove={handlePointer}
            onPointerDown={handlePointer}
            onPointerLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(last)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={handleKey}
          />
        </svg>
      )}

      {active && activeIndex !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-2xl bg-surface px-3 py-2 text-center shadow-card"
          style={{
            left: Math.min(Math.max(points[activeIndex].x, 60), width - 60),
            top: Math.max(points[activeIndex].y - 64, 0),
          }}
        >
          <p className="text-[15px] font-semibold leading-tight">{formatMoney(active.value)}</p>
          <p className="text-[12px] text-muted">{active.label}</p>
        </div>
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
