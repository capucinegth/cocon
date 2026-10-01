import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article";
  padded?: boolean;
}

/** Carte de base : fond blanc, grands arrondis, ombre très légère, pas de bordure. */
export function Card({ as: Tag = "section", padded = true, className, ...props }: CardProps) {
  return <Tag className={cn("rounded-card bg-surface shadow-card", padded && "p-5 sm:p-6", className)} {...props} />;
}
