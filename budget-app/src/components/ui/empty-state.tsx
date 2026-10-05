import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({ emoji, title, children, className }: { emoji: string; title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-8 text-center", className)}>
      <span aria-hidden className="grid size-14 place-items-center rounded-full bg-blush-50 text-2xl">
        {emoji}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-xs text-sm text-muted">{children}</p>}
    </div>
  );
}
