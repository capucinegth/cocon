"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { toneStyles } from "@/config/tones";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types/finance";

/** Groupe de champ : libellé discret au-dessus du contrôle. */
export function FormField({ label, hint, children, as = "fieldset" }: { label: string; hint?: string; children: ReactNode; as?: "fieldset" | "div" }) {
  const Tag = as;
  const Legend = as === "fieldset" ? "legend" : "p";
  return (
    <Tag className="min-w-0">
      <Legend className="mb-2.5 text-sm font-semibold text-muted">
        {label}
        {hint && <span className="font-medium"> ({hint})</span>}
      </Legend>
      {children}
    </Tag>
  );
}

export const inputStyles =
  "h-12 w-full rounded-2xl bg-canvas px-4 text-[15px] text-ink outline-none ring-1 ring-transparent transition-shadow duration-200 focus:ring-2 focus:ring-blush-300";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputStyles, className)} {...props} />;
}

/** Garde uniquement chiffres + une virgule, 2 décimales max. */
export function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const [units = "", ...rest] = cleaned.split(",");
  const trimmedUnits = units.replace(/^0+(?=\d)/, "").slice(0, 7);
  return rest.length ? `${trimmedUnits || "0"},${rest.join("").slice(0, 2)}` : trimmedUnits;
}

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Signe affiché devant le montant (−, + ou rien). */
  prefix?: string;
  label: string;
  autoFocus?: boolean;
  size?: "lg" | "md";
}

/** Grand champ de montant centré, qui s'ajuste exactement à son contenu. */
export function AmountInput({ value, onChange, prefix, label, autoFocus, size = "lg" }: AmountInputProps) {
  const big = size === "lg";
  return (
    <label className={cn("flex items-baseline justify-center gap-2 rounded-3xl bg-canvas px-4", big ? "py-7" : "py-4")}>
      <span className="sr-only">{label}</span>
      {prefix && (
        <span aria-hidden className={cn("font-semibold text-muted", big ? "text-3xl" : "text-2xl")}>
          {prefix}
        </span>
      )}
      {/* Le champ prend la largeur de son texte grâce à un « miroir » invisible. */}
      <span className={cn("inline-grid font-semibold leading-none tracking-tight", big ? "text-[52px]" : "text-[36px]")}>
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
          {value || "0"}
        </span>
        <input
          data-autofocus={autoFocus || undefined}
          size={1}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(sanitizeAmount(event.target.value))}
          className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-center outline-none placeholder:text-ink/20"
        />
      </span>
      <span aria-hidden className={cn("font-semibold", big ? "text-3xl" : "text-2xl")}>
        €
      </span>
    </label>
  );
}

export function EmojiPicker({ value, options, onChange }: { value: string; options: string[]; onChange: (emoji: string) => void }) {
  return (
    <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1" role="radiogroup" aria-label="Icône">
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="radio"
          aria-checked={emoji === value}
          aria-label={emoji}
          onClick={() => onChange(emoji)}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl text-xl transition-all duration-200 active:scale-95",
            emoji === value ? "bg-ink shadow-card" : "bg-canvas hover:bg-blush-50",
          )}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  );
}

export function TonePicker({ value, options, onChange }: { value: Tone; options: { tone: Tone; label: string }[]; onChange: (tone: Tone) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
      {options.map(({ tone, label }) => (
        <button
          key={tone}
          type="button"
          role="radio"
          aria-checked={tone === value}
          onClick={() => onChange(tone)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full pl-2 pr-4 text-[15px] font-medium transition-all duration-200 active:scale-[0.97]",
            tone === value ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
          )}
        >
          <span aria-hidden className={cn("size-7 rounded-full ring-2 ring-surface", toneStyles[tone].fill)} />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Montant → texte du champ (« 54,2 »), vide pour zéro. */
export function amountToInput(amount: number | undefined): string {
  return amount ? String(Math.round(amount * 100) / 100).replace(".", ",") : "";
}
