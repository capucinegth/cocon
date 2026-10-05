import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "soft" | "white" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90 disabled:bg-ink/25",
  soft: "bg-blush-100 text-ink hover:bg-blush-200",
  white: "bg-surface/90 text-ink shadow-sm hover:bg-surface",
  ghost: "text-ink hover:bg-blush-50",
  accent: "text-blush-700 hover:bg-blush-50",
  danger: "text-blush-700 hover:bg-blush-50",
};

const sizes: Record<Size, string> = {
  sm: "h-10 gap-1.5 px-3.5 text-sm",
  md: "h-11 gap-2 px-5 text-[15px]",
  lg: "h-14 gap-2 px-6 text-base",
  icon: "size-11",
};

/** Classes de bouton, réutilisables aussi sur un <Link>. */
export function buttonStyles({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none",
    variants[variant],
    sizes[size],
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
