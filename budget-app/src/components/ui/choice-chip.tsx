import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface ChoiceChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

/** Puce sélectionnable (catégorie, compte, date…). Grande zone tactile. */
export function ChoiceChip({ selected, className, ...props }: ChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-all duration-200 active:scale-[0.97]",
        selected ? "bg-ink text-white" : "bg-blush-50 text-ink hover:bg-blush-100",
        className,
      )}
      {...props}
    />
  );
}
