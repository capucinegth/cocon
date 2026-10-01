import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

const sizes = {
  sm: "size-9 rounded-xl text-base",
  md: "size-11 rounded-2xl text-lg",
  lg: "size-14 rounded-[20px] text-2xl",
};

interface CategoryBadgeProps {
  emoji: string;
  tone: Tone;
  size?: keyof typeof sizes;
  className?: string;
}

/** Pastille arrondie contenant l'emoji d'une catégorie ou d'un objectif. */
export function CategoryBadge({ emoji, tone, size = "md", className }: CategoryBadgeProps) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center", toneStyles[tone].badge, sizes[size], className)}>
      {emoji}
    </span>
  );
}
