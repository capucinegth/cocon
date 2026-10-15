"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        // Zone tactile élargie à 44 px (pseudo-élément), sans changer l'apparence de l'interrupteur.
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
        checked ? "bg-blush-300" : "bg-ink/12",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-300 ease-(--ease-soft)",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
