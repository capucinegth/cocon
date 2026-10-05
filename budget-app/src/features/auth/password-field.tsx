"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { inputStyles } from "@/components/ui/form";
import { cn } from "@/lib/cn";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}

/** Mot de passe avec bouton « Afficher » (pratique sur mobile). */
export function PasswordField({ label, value, onChange, autoComplete, hint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="mb-2.5 block text-sm font-semibold text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          aria-describedby={hint ? hintId : undefined}
          className={cn(inputStyles, "pr-14")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute right-1 top-1 grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-blush-50 hover:text-ink"
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-2 text-[13px] text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
