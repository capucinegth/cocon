"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "./button";

interface ConfirmButtonProps {
  children: ReactNode;
  /** Question affichée avant de confirmer. */
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  className?: string;
}

/** Action destructive en deux temps : rien n'est supprimé sur un simple toucher accidentel. */
export function ConfirmButton({ children, question, confirmLabel, onConfirm, pending, className }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button variant="danger" onClick={() => setArmed(true)} className={className}>
        {children}
      </Button>
    );
  }

  return (
    <div role="group" aria-label={question} className="flex animate-fade flex-col gap-3 rounded-2xl bg-blush-50 p-4">
      <p className="text-[14px] font-medium text-ink">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="white" size="sm" onClick={() => setArmed(false)} disabled={pending}>
          Annuler
        </Button>
        <Button variant="primary" size="sm" onClick={onConfirm} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Un instant…" : confirmLabel}
        </Button>
      </div>
    </div>
  );
}
