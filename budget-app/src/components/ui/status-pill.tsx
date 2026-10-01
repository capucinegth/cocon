import { CalendarClock, Check, CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Status = "done" | "scheduled" | "warning" | "over";

const styles: Record<Status, { className: string; icon: LucideIcon }> = {
  done: { className: "bg-sage-50 text-sage-700", icon: Check },
  scheduled: { className: "bg-lilac-50 text-lilac-700", icon: CalendarClock },
  warning: { className: "bg-peach-50 text-peach-700", icon: CircleAlert },
  over: { className: "bg-blush-50 text-blush-700", icon: CircleAlert },
};

/** Petit état textuel : toujours une icône + un libellé, jamais la couleur seule. */
export function StatusPill({ status, children, className }: { status: Status; children: ReactNode; className?: string }) {
  const { className: tone, icon: Icon } = styles[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon size={14} strokeWidth={2.2} aria-hidden />
      {children}
    </span>
  );
}
