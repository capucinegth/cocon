import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectPillProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: LucideIcon;
  /** Filtre actif (différent de la valeur par défaut) : mis en avant. */
  active?: boolean;
  className?: string;
}

/** Liste déroulante native habillée en pilule : accessible et confortable sur mobile. */
export function SelectPill<T extends string>({ label, value, options, onChange, icon: Icon, active, className }: SelectPillProps<T>) {
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {Icon && (
        <Icon
          size={16}
          className={cn("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2", active ? "text-white" : "text-muted")}
          aria-hidden
        />
      )}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(
          "h-11 w-full cursor-pointer appearance-none rounded-full pr-9 text-[15px] font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush-700",
          Icon ? "pl-10" : "pl-4",
          active ? "bg-ink text-white" : "bg-surface text-ink shadow-card ring-1 ring-ink/5 hover:bg-blush-50",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className={cn("pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2", active ? "text-white" : "text-muted")}
        aria-hidden
      />
    </div>
  );
}
