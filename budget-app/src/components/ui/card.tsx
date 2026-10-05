import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "section" | "div" | "article" | "aside";
  padded?: boolean;
}

/** Carte de base : fond blanc, bordure à peine visible, ombre très légère. */
export function Card({ as: Tag = "section", padded = true, className, ...props }: CardProps) {
  return <Tag className={cn("card", padded && "p-5 sm:p-6", className)} {...props} />;
}
