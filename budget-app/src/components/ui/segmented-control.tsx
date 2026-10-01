"use client";

import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full bg-blush-50 p-1", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 flex-1 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-all duration-200",
              selected ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
