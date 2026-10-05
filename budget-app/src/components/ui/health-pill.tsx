import { CalendarCheck, Feather, Leaf, Wind, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BudgetHealth } from "@/lib/budget";

const styles: Record<BudgetHealth, { label: string; hint: string; icon: LucideIcon; className: string }> = {
  comfortable: {
    label: "Confortable",
    hint: "Tu peux dépenser un peu plus que ton rythme prévu.",
    icon: Leaf,
    className: "bg-sage-50 text-sage-700",
  },
  attention: {
    label: "Attention",
    hint: "Ton disponible par jour passe sous ton rythme prévu.",
    icon: Feather,
    className: "bg-peach-50 text-peach-700",
  },
  tight: {
    label: "Budget serré",
    hint: "Il reste peu de marge jusqu'à la fin du mois.",
    icon: Wind,
    className: "bg-blush-50 text-blush-700",
  },
  closed: {
    label: "Mois terminé",
    hint: "Bilan du mois écoulé.",
    icon: CalendarCheck,
    className: "bg-surface/80 text-ink-soft",
  },
};

export function healthHint(health: BudgetHealth): string {
  return styles[health].hint;
}

/** État du budget, sans couleur agressive : toujours une icône + un mot. */
export function HealthPill({ health, className }: { health: BudgetHealth; className?: string }) {
  const { label, icon: Icon, className: tone } = styles[health];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold", tone, className)}>
      <Icon size={15} strokeWidth={2.2} aria-hidden />
      {label}
    </span>
  );
}
