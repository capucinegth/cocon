"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { parseReceipt, type ReceiptReading } from "@/lib/receipt";

type ScanState = { status: "idle" } | { status: "reading"; progress: number } | { status: "done"; message: string; found: boolean };

/**
 * « Scanner un ticket » : photo (appareil photo du téléphone, ou image existante), lecture sur l'appareil,
 * puis le montant (et si possible le magasin et la date) pré-remplissent le formulaire, à vérifier.
 */
export function ReceiptScanButton({ today, onRead }: { today: string; onRead: (reading: ReceiptReading) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const reading = state.status === "reading";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setState({ status: "reading", progress: 0 });
    try {
      const { readReceiptText } = await import("./receipt-scanner");
      const text = await readReceiptText(file, (progress) => setState({ status: "reading", progress }));
      const result = parseReceipt(text, today);
      onRead(result);
      setState(
        result.amount !== undefined
          ? { status: "done", found: true, message: `Ticket lu : ${formatMoney(result.amount, { cents: "always" })}. Vérifie le montant avant d'enregistrer.` }
          : { status: "done", found: false, message: "Montant introuvable sur cette photo : saisis-le, ou reprends une photo plus nette et bien droite." },
      );
    } catch {
      setState({ status: "done", found: false, message: "Lecture impossible pour le moment. Saisis le montant à la main." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="receipt-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={reading}
        aria-busy={reading || undefined}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-blush-50 px-4 text-[14px] font-semibold text-blush-700 transition-colors hover:bg-blush-100 disabled:opacity-60"
      >
        <Camera size={17} aria-hidden />
        {reading ? `Lecture du ticket… ${Math.round(state.progress * 100)} %` : "Scanner un ticket"}
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {state.status === "done" ? state.message : reading ? "Lecture du ticket en cours" : ""}
      </p>
      {state.status === "done" && (
        <p aria-hidden className={state.found ? "text-center text-[13px] text-sage-700" : "text-center text-[13px] text-muted"}>
          {state.message}
        </p>
      )}
    </div>
  );
}
