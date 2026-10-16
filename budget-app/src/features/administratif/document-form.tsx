"use client";

import { FormField, TextInput } from "@/components/ui/form";
import { SelectPill } from "@/components/ui/select-pill";
import { cn } from "@/lib/cn";
import { defaultType, documentCategories, typeInfo, typesOf } from "@/lib/admin/catalog";
import type { Classification } from "@/lib/admin/classify";
import type { AdminDocument, DocumentCategory } from "@/types/documents";
import { FolderPicker } from "./folder-picker";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Valeurs du formulaire (texte, comme les champs) ; converties à l'enregistrement. */
export interface DocumentFormValues {
  title: string;
  category: DocumentCategory | null;
  type: string;
  documentDate: string;
  periodYear: string;
  periodMonth: string;
  description: string;
  /** Dossier personnel (« » : aucun). */
  folderId: string;
}

export function emptyValues(title = "", folderId = ""): DocumentFormValues {
  return { title, category: null, type: "", documentDate: "", periodYear: "", periodMonth: "", description: "", folderId };
}

export function valuesFromClassification(classification: Classification): DocumentFormValues {
  return {
    ...emptyValues(classification.title),
    category: classification.category,
    type: classification.type,
    periodYear: classification.periodYear ? String(classification.periodYear) : "",
    periodMonth: classification.periodMonth ? String(classification.periodMonth) : "",
  };
}

export function valuesFromDocument(doc: AdminDocument): DocumentFormValues {
  return {
    title: doc.title,
    category: doc.category,
    type: doc.type,
    documentDate: doc.documentDate ?? "",
    periodYear: doc.periodYear ? String(doc.periodYear) : "",
    periodMonth: doc.periodMonth ? String(doc.periodMonth) : "",
    description: doc.description,
    folderId: doc.folderId ?? "",
  };
}

/** Champs de la fiche communs à l'import et à la modification (période seulement si le type en a une). */
export function toDocumentFields(values: DocumentFormValues) {
  const period = typeInfo(values.type, values.category ?? "professionnel").period;
  const periodYear = period && values.periodYear ? Number(values.periodYear) : undefined;
  return {
    title: values.title.trim(),
    category: values.category!,
    type: values.type,
    documentDate: values.documentDate || undefined,
    periodYear,
    periodMonth: period === "month" && periodYear && values.periodMonth ? Number(values.periodMonth) : undefined,
    description: values.description.trim(),
    folderId: values.folderId || undefined,
  };
}

export function formProblem(values: DocumentFormValues): string | null {
  if (!values.category) return "Choisis une catégorie.";
  if (!values.title.trim()) return "Donne un titre à ce document.";
  return null;
}

/** Titre, catégorie, type, période, date (et description en modification). */
export function DocumentForm({
  values,
  onChange,
  today,
  withDescription = false,
}: {
  values: DocumentFormValues;
  onChange: (values: DocumentFormValues) => void;
  today: string;
  withDescription?: boolean;
}) {
  const set = (patch: Partial<DocumentFormValues>) => onChange({ ...values, ...patch });
  const type = values.category ? typeInfo(values.type, values.category) : undefined;
  const currentYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 17 }, (_, i) => String(currentYear + 1 - i));

  return (
    <div className="flex flex-col gap-6">
      <label className="block">
        <span className="mb-2.5 block text-sm font-semibold text-muted">Titre</span>
        <TextInput value={values.title} onChange={(event) => set({ title: event.target.value })} maxLength={120} placeholder="Ex. Fiche de paie de septembre" />
      </label>

      <FormField label="Catégorie">
        <div className="grid grid-cols-2 gap-2">
          {documentCategories.map((category) => {
            const selected = values.category === category.id;
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => set({ category: category.id, type: category.id === values.category ? values.type : defaultType(category.id) })}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-2 rounded-2xl px-3 py-2 text-left text-[15px] font-semibold transition-all duration-200 active:scale-[0.98]",
                  selected ? "bg-ink text-white" : "bg-canvas hover:bg-blush-50",
                )}
              >
                <span aria-hidden className="text-lg">
                  {category.emoji}
                </span>
                <span className="min-w-0 break-words">{category.label}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      {values.category && (
        <FormField label="Type de document" as="div">
          <SelectPill
            label="Type de document"
            value={values.type}
            onChange={(next) => set({ type: next })}
            options={typesOf(values.category).map((t) => ({ value: t.id, label: t.label }))}
            className="w-full"
          />
        </FormField>
      )}

      {type?.period && (
        <FormField label={type.period === "month" ? "Période" : "Année"} as="div">
          <div className={cn("grid gap-2", type.period === "month" ? "grid-cols-2" : "grid-cols-1")}>
            {type.period === "month" && (
              <SelectPill
                label="Mois"
                value={values.periodMonth}
                onChange={(next) => set({ periodMonth: next })}
                options={[{ value: "", label: "Mois…" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m.charAt(0).toUpperCase() + m.slice(1) }))]}
                className="w-full"
              />
            )}
            <SelectPill
              label="Année"
              value={values.periodYear}
              onChange={(next) => set({ periodYear: next })}
              options={[{ value: "", label: "Année…" }, ...years.map((y) => ({ value: y, label: y }))]}
              className="w-full"
            />
          </div>
        </FormField>
      )}

      <FormField label="Dossier" hint="facultatif" as="div">
        <FolderPicker value={values.folderId} onChange={(folderId) => set({ folderId })} />
      </FormField>

      <label className="block">
        <span className="mb-2.5 block text-sm font-semibold text-muted">
          Date du document <span className="font-medium">(facultatif)</span>
        </span>
        <TextInput type="date" value={values.documentDate} onChange={(event) => set({ documentDate: event.target.value })} className="font-medium" />
      </label>

      {withDescription && (
        <label className="block">
          <span className="mb-2.5 block text-sm font-semibold text-muted">
            Note <span className="font-medium">(facultatif)</span>
          </span>
          <TextInput value={values.description} onChange={(event) => set({ description: event.target.value })} maxLength={1000} placeholder="Un détail à retenir" />
        </label>
      )}
    </div>
  );
}
