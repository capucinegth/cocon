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
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300",
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
