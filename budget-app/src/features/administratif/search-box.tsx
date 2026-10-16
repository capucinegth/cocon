"use client";

import { Search, X } from "lucide-react";

/** Recherche dans les documents (titre, type, catégorie, année, informations validées). */
export function SearchBox({ value, onChange, placeholder = "Rechercher : salaire, 2026, assurance voiture…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">Rechercher un document</span>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        className="h-12 w-full rounded-full bg-surface pl-11 pr-12 text-[15px] shadow-card outline-none ring-1 ring-ink/5 focus:ring-2 focus:ring-blush-300 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Effacer la recherche"
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-blush-50"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </label>
  );
}
