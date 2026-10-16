"use client";

import { Maximize, RotateCcw, ScanLine } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fullQuad, isValidQuad, type Quad, type ScanMode } from "@/lib/admin/scan";
import type { ScanSource } from "./photo-pipeline";

const CORNER_LABELS = ["Coin en haut à gauche", "Coin en haut à droite", "Coin en bas à droite", "Coin en bas à gauche"];

export const scanModes: { value: ScanMode; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "couleur", label: "Couleur" },
  { value: "original", label: "Original" },
];

const sameQuad = (a: Quad, b: Quad) => a.every((p, i) => Math.abs(p.x - b[i].x) < 0.5 && Math.abs(p.y - b[i].y) < 0.5);

/**
 * Détourage d'une page : la photo, la feuille repérée et ses 4 coins à ajuster au doigt
 * (ou aux flèches du clavier), puis le rendu (« Document » par défaut).
 */
export function ScanEditor({
  source,
  initialQuad,
  initialMode,
  progress,
  busy,
  error,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  onRetake,
}: {
  source: ScanSource;
  initialQuad: Quad;
  initialMode: ScanMode;
  /** « Photo 2 sur 3 » quand plusieurs photos attendent. */
  progress?: string;
  busy: boolean;
  error: string | null;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (quad: Quad, mode: ScanMode) => void;
  onCancel: () => void;
  onRetake?: () => void;
}) {
  const [quad, setQuad] = useState<Quad>(initialQuad);
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const { width, height } = source;
  const valid = isValidQuad(quad, width, height);
  const whole = fullQuad(width, height);

  const moveCorner = (index: number, x: number, y: number) =>
    setQuad((current) => current.map((p, i) => (i === index ? { x: Math.min(width, Math.max(0, x)), y: Math.min(height, Math.max(0, y)) } : p)) as Quad);

  function onPointerDown(index: number, event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = index;
  }

  function onPointerMove(index: number, event: PointerEvent<HTMLButtonElement>) {
    if (dragging.current !== index || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    moveCorner(index, ((event.clientX - rect.left) / rect.width) * width, ((event.clientY - rect.top) / rect.height) * height);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    const step = (event.shiftKey ? 0.05 : 0.01) * Math.max(width, height);
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    moveCorner(index, quad[index].x + delta[0], quad[index].y + delta[1]);
  }

  const outline = quad.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
        <div>
          <h3 className="text-[17px] font-semibold">
            Ajuste les bords de la page
            {progress && <span className="font-medium text-muted"> · {progress}</span>}
          </h3>
          <p id="scan-help" className="mt-1 text-[14px] text-muted">
            {source.detected
              ? "Cocon a repéré la feuille. Fais glisser un coin s'il n'est pas bien placé."
              : "La feuille n'a pas été repérée : place les 4 coins sur ceux de la feuille."}
          </p>
        </div>

        <div className="rounded-3xl bg-ink/90 p-3">
          <div ref={frame} className="relative mx-auto w-fit touch-none select-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
            <img src={source.url} alt="Photo à détourer" draggable={false} className="block max-h-[44vh] max-w-full rounded-lg" />
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-0 size-full">
              <path d={`M0 0H${width}V${height}H0Z M${quad.map((p) => `${p.x} ${p.y}`).join(" L")} Z`} fillRule="evenodd" fill="rgb(0 0 0 / 0.45)" />
              <polygon points={outline} fill="none" stroke={valid ? "#e8a7b8" : "#ef4444"} strokeWidth={3} vectorEffect="non-scaling-stroke" />
            </svg>
            {quad.map((corner, index) => (
              <button
                key={CORNER_LABELS[index]}
                type="button"
                aria-label={CORNER_LABELS[index]}
                aria-describedby="scan-keys"
                data-testid={`scan-corner-${index}`}
                onPointerDown={(event) => onPointerDown(index, event)}
                onPointerMove={(event) => onPointerMove(index, event)}
                onPointerUp={() => (dragging.current = null)}
                onPointerCancel={() => (dragging.current = null)}
                onKeyDown={(event) => onKeyDown(index, event)}
                className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full active:cursor-grabbing"
                style={{ left: `${(corner.x / width) * 100}%`, top: `${(corner.y / height) * 100}%` }}
              >
                <span aria-hidden className="size-6 rounded-full border-[3px] border-white bg-blush-500/80 shadow-md" />
              </button>
            ))}
          </div>
        </div>
        <p id="scan-keys" className="sr-only">
          Déplace ce coin avec les flèches du clavier, Maj pour aller plus vite.
        </p>

        <div className="flex flex-wrap gap-2">
          {source.detected && !sameQuad(quad, source.detected) && (
            <Button variant="soft" onClick={() => setQuad(source.detected!)}>
              <ScanLine size={17} aria-hidden />
              Bords repérés
            </Button>
          )}
          {!sameQuad(quad, whole) && (
            <Button variant="soft" onClick={() => setQuad(whole)}>
              <Maximize size={17} aria-hidden />
              Toute la photo
            </Button>
          )}
          {onRetake && (
            <Button variant="ghost" onClick={onRetake} disabled={busy}>
              <RotateCcw size={17} aria-hidden />
              Reprendre la photo
            </Button>
          )}
        </div>

        <div>
          <p className="mb-2.5 text-sm font-semibold text-muted">Rendu</p>
          <SegmentedControl label="Rendu" options={scanModes} value={mode} onChange={setMode} className="w-full" />
          <p className="mt-2 text-[13px] text-muted">
            {mode === "document"
              ? "Fond blanc, texte bien noir, ombres effacées : idéal pour les papiers."
              : mode === "couleur"
                ? "Couleurs gardées, ombres atténuées : pour les tampons, logos ou cartes."
                : "La photo telle quelle, simplement redressée."}
          </p>
        </div>
        {!valid && <FormError message="Les coins se croisent ou la zone est trop petite : replace-les sur la feuille." />}
        <FormError message={error} />
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        {busy && (
          <p role="status" className="mb-2 text-[14px] font-medium text-ink-soft">
            Scan de la page…
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="shrink-0">
            {cancelLabel}
          </Button>
          <Button size="lg" onClick={() => onConfirm(quad, mode)} disabled={!valid || busy} className="flex-1" aria-busy={busy || undefined}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
