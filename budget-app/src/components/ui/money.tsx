import { cn } from "@/lib/cn";
import { formatMoney, splitMoney, type CentsDisplay, type SignDisplay } from "@/lib/format";

interface MoneyProps {
  value: number;
  sign?: SignDisplay;
  cents?: CentsDisplay;
  className?: string;
}

/**
 * Montant affiché. Toujours passer par ce composant pour un montant visible :
 * il porte l'attribut qui permet de le flouter en mode discret.
 */
export function Money({ value, sign, cents, className }: MoneyProps) {
  return (
    <span data-money className={cn("whitespace-nowrap", className)}>
      {formatMoney(value, { sign, cents })}
    </span>
  );
}

/** Grand montant : euros en grand, centimes plus petits (carte principale). */
export function HeroMoney({ value, className, centsClassName }: { value: number; className?: string; centsClassName?: string }) {
  const { units, cents } = splitMoney(value);
  return (
    <span data-money className={cn("whitespace-nowrap", className)}>
      {units}
      <span className={centsClassName}>{cents}&nbsp;€</span>
    </span>
  );
}
