"use client";

import { Check, CircleCheck, Download, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AmountInput, TextInput, amountToInput } from "@/components/ui/form";
import { FormError } from "@/components/ui/form-error";
import { Money } from "@/components/ui/money";
import { SelectPill } from "@/components/ui/select-pill";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { useAsyncAction } from "@/hooks/use-async-action";
import { categoryInfo, deadlineKindLabel, deadlineKinds, fieldDefinitions, typeInfo } from "@/lib/admin/catalog";
import { formatDocDate, formatFieldValue, periodLabel, relativeDue } from "@/lib/admin/documents";
import { parseAmountInput, roundCents } from "@/lib/format";
import { RepositoryError } from "@/services/repository";
import { useDocuments } from "@/store/documents-store";
import { useUI } from "@/store/ui-store";
import type { AdminDocument, DeadlineKind, DocumentField } from "@/types/documents";
import { DocumentForm, formProblem, toDocumentFields, valuesFromDocument, type DocumentFormValues } from "./document-form";
import { downloadFile, viewFile } from "./open-file";

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Saisie d'une information selon son genre (texte, montant, date, mois, année). */
function FieldEditor({ document, fieldKey, field, onDone }: { document: AdminDocument; fieldKey: string; field?: DocumentField; onDone: () => void }) {
  const { saveField } = useDocuments();
  const definition = fieldDefinitions[fieldKey];
  const [text, setText] = useState(field?.text ?? "");
  const [amount, setAmount] = useState(amountToInput(field?.amount));
  const [date, setDate] = useState(definition.kind === "month" ? (field?.date?.slice(0, 7) ?? "") : definition.kind === "year" ? (field?.date?.slice(0, 4) ?? "") : (field?.date ?? ""));
  const { pending, error, run } = useAsyncAction();

  async function submit() {
    const ok = await run(() =>
      saveField({
        documentId: document.id,
        key: fieldKey,
        validate: true,
        text,
        amount: definition.kind === "amount" && amount ? roundCents(parseAmountInput(amount)) : undefined,
        date: !date ? undefined : definition.kind === "month" ? `${date}-01` : definition.kind === "year" ? `${date}-01-01` : date,
      }),
    );
    if (ok) onDone();
  }

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-canvas p-3">
      {definition.kind === "text" && <TextInput aria-label={definition.label} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} className="bg-surface" data-autofocus />}
      {definition.kind === "amount" && <AmountInput label={`${definition.label} en euros`} value={amount} onChange={setAmount} size="md" />}
      {definition.kind === "date" && <TextInput type="date" aria-label={definition.label} value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface font-medium" />}
      {definition.kind === "month" && <TextInput type="month" aria-label={definition.label} value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface font-medium" placeholder="AAAA-MM" />}
      {definition.kind === "year" && (
        <TextInput aria-label={definition.label} inputMode="numeric" value={date} onChange={(e) => setDate(e.target.value.replace(/\D/g, "").slice(0, 4))} className="bg-surface font-medium" placeholder="AAAA" />
      )}
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

function Informations({ document }: { document: AdminDocument }) {
  const { fields, validateField, deleteField } = useDocuments();
  const [editing, setEditing] = useState<string | null>(null);
  const action = useAsyncAction();
  const own = fields.filter((f) => f.documentId === document.id);
  const keys = [...new Set([...typeInfo(document.type, document.category).fields, ...own.map((f) => f.key)])].filter((key) => fieldDefinitions[key]);
  if (keys.length === 0) return null;

  return (
    <section aria-labelledby="infos-title">
      <h3 id="infos-title" className="text-sm font-semibold text-muted">
        Informations
      </h3>
      <p className="mt-0.5 text-[13px] text-muted">Seules les informations validées par toi sont prises en compte. Rien n&apos;est envoyé dans ton budget.</p>
      <ul className="mt-2 divide-y divide-line">
        {keys.map((key) => {
          const definition = fieldDefinitions[key];
          const field = own.find((f) => f.key === key);
          const amountField = definition.kind === "amount" && field?.amount !== undefined;
          return (
            <li key={key} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-muted">{definition.label}</span>
                  <span className="block break-words text-[15px] font-semibold">
                    {!field ? <span className="font-normal text-muted">Non renseigné</span> : amountField ? <Money value={field.amount!} /> : formatFieldValue(field)}
                  </span>
                </span>
                {field && (field.status === "valide" ? <StatusPill status="done">Validée</StatusPill> : <StatusPill status="warning">À vérifier</StatusPill>)}
                <span className="flex">
                  {field?.status === "propose" && (
                    <Button variant="accent" size="sm" onClick={() => void action.run(() => validateField(field))} aria-label={`Valider : ${definition.label}`}>
                      <Check size={16} aria-hidden />
                      Valider
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setEditing(editing === key ? null : key)} aria-label={field ? `Modifier : ${definition.label}` : `Ajouter : ${definition.label}`}>
                    {field ? <Pencil size={16} aria-hidden /> : <Plus size={17} aria-hidden />}
                  </Button>
                  {field && (
                    <Button variant="ghost" size="icon" onClick={() => void action.run(() => deleteField(field))} aria-label={`Effacer : ${definition.label}`}>
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  )}
                </span>
              </div>
              {editing === key && <FieldEditor key={field?.id ?? key} document={document} fieldKey={key} field={field} onDone={() => setEditing(null)} />}
            </li>
          );
        })}
      </ul>
      <FormError message={action.error} className="mt-2" />
    </section>
  );
}

function Deadlines({ document }: { document: AdminDocument }) {
  const { deadlines, fields, today, saveDeadline, deleteDeadline } = useDocuments();
  const own = deadlines.filter((d) => d.documentId === document.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [kind, setKind] = useState<DeadlineKind>("echeance");
  const add = useAsyncAction();
  const action = useAsyncAction();
  // Une date VALIDÉE (échéance, date limite, fin de contrat) peut devenir une échéance en un geste.
  const suggestions = fields.filter(
    (f) =>
      f.documentId === document.id &&
      f.status === "valide" &&
      f.date &&
      ["date_echeance", "date_limite", "date_fin"].includes(f.key) &&
      !own.some((d) => d.dueDate === f.date),
  );

  function startAdding(preset?: { label: string; date: string; kind: DeadlineKind }) {
    setLabel(preset?.label ?? "");
    setDueDate(preset?.date ?? "");
    setKind(preset?.kind ?? "echeance");
    setAdding(true);
  }

  async function submit() {
    const ok = await add.run(() => saveDeadline({ documentId: document.id, label, dueDate, kind }));
    if (ok) setAdding(false);
  }

  return (
    <section aria-labelledby="deadlines-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="deadlines-title" className="text-sm font-semibold text-muted">
          Échéances
        </h3>
        {!adding && (
          <Button variant="accent" size="sm" onClick={() => startAdding()} className="-mr-3">
            <Plus size={16} aria-hidden />
            Ajouter une échéance
          </Button>
        )}
      </div>
      {own.length === 0 && !adding && <p className="mt-1 text-[13px] text-muted">Aucune échéance pour ce document.</p>}
      <ul className="mt-1 divide-y divide-line">
        {own.map((deadline) => (
          <li key={deadline.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="min-w-0 flex-1">
              <span className={`block break-words text-[15px] font-semibold ${deadline.doneAt ? "text-muted line-through" : ""}`}>{deadline.label}</span>
              <span className="block text-[13px] text-muted">
                {deadlineKindLabel(deadline.kind)} · {formatDocDate(deadline.dueDate)} · {deadline.doneAt ? "traitée" : relativeDue(deadline.dueDate, today)}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void action.run(() => saveDeadline({ ...deadline, doneAt: deadline.doneAt ? undefined : new Date().toISOString() }))}
              aria-pressed={Boolean(deadline.doneAt)}
              aria-label={`${deadline.label} : traitée`}
            >
              <CircleCheck size={16} aria-hidden />
              {deadline.doneAt ? "Traitée" : "Marquer traitée"}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void action.run(() => deleteDeadline(deadline))} aria-label={`Supprimer l'échéance ${deadline.label}`}>
              <Trash2 size={16} aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {!adding && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((f) => (
            <Button
              key={f.id}
              variant="soft"
              size="sm"
              onClick={() =>
                startAdding({
                  label: `${fieldDefinitions[f.key].label} · ${document.title}`.slice(0, 120),
                  date: f.date!,
                  kind: f.key === "date_fin" ? "fin_contrat" : f.key === "date_limite" ? "date_limite" : "echeance",
                })
              }
            >
              <Plus size={15} aria-hidden />
              Échéance du {formatDocDate(f.date!).toLowerCase()}
            </Button>
          ))}
        </div>
      )}
      {adding && (
        <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-canvas p-3">
          <TextInput aria-label="Nom de l'échéance" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Ex. Échéance assurance habitation" className="bg-surface" />
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <TextInput type="date" aria-label="Date de l'échéance" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-surface font-medium" />
            <SelectPill label="Type d'échéance" value={kind} onChange={setKind} options={deadlineKinds.map((k) => ({ value: k.id, label: k.label }))} className="w-full" />
          </div>
          <FormError message={add.error} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={() => void submit()} disabled={add.pending}>
              {add.pending ? "Enregistrement…" : "Enregistrer l'échéance"}
            </Button>
          </div>
        </div>
      )}
      <FormError message={action.error} className="mt-2" />
    </section>
  );
}

function DocumentDetail({ documentId }: { documentId: string }) {
  const { documents, today, fileUrl, updateDocument, deleteDocument, closeSheet } = useDocuments();
  const { showToast } = useUI();
  const document = documents.find((d) => d.id === documentId);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<DocumentFormValues | null>(document ? valuesFromDocument(document) : null);
  const open = useAsyncAction();
  const save = useAsyncAction();
  const remove = useAsyncAction();

  if (!document || !values) return <p className="px-6 pb-8 pt-2 text-[15px] text-muted">Ce document n&apos;existe plus.</p>;
  const category = categoryInfo(document.category);
  const type = typeInfo(document.type, document.category);
  const when = periodLabel(document);

  async function submitEdit() {
    const problem = formProblem(values!);
    const ok = await save.run(async () => {
      if (problem) throw new RepositoryError(problem, "validation");
      await updateDocument({ ...document!, ...toDocumentFields(values!), classificationStatus: "confirme", classificationSource: "utilisateur" });
    });
    if (ok) {
      setEditing(false);
      showToast("Document mis à jour");
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col">
        <div className="px-6 pb-6 pt-2">
          <DocumentForm values={values} onChange={setValues} today={today} withDescription />
        </div>
        <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
          <FormError message={save.error ?? formProblem(values)} className="mb-3" />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button size="lg" className="flex-1" onClick={() => void submitEdit()} disabled={save.pending || formProblem(values) !== null}>
              {save.pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">
      <div className="flex items-start gap-3 rounded-3xl bg-canvas p-4">
        <CategoryBadge emoji={category.emoji} tone={category.tone} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[17px] font-semibold leading-snug">{document.title}</p>
          <p className="mt-0.5 break-words text-[13px] text-muted">
            {[category.label, type.label, when, document.documentDate ? formatDocDate(document.documentDate) : ""].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 break-all text-[13px] text-muted">
            {document.fileName} · {sizeLabel(document.fileSize)}
            {document.pageCount ? ` · ${document.pageCount} page${document.pageCount > 1 ? "s" : ""}` : ""}
          </p>
          {document.description && <p className="mt-2 break-words text-[14px] text-ink-soft">{document.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => void open.run(() => viewFile(() => fileUrl(document, "view")))} disabled={open.pending}>
          <ExternalLink size={17} aria-hidden />
          Consulter
        </Button>
        <Button variant="soft" onClick={() => void open.run(() => downloadFile(() => fileUrl(document, "download"), document.fileName))} disabled={open.pending}>
          <Download size={17} aria-hidden />
          Télécharger
        </Button>
      </div>
      <FormError message={open.error} />

      {document.classificationStatus === "a_verifier" && (
        <div className="rounded-2xl bg-peach-50 px-4 py-3">
          <p className="text-[14px] font-semibold">Classement proposé par Cocon</p>
          <p className="text-[13px] text-ink-soft">
            {category.label} · {type.label} : est-ce correct ?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save.run(() => updateDocument({ ...document, classificationStatus: "confirme" }))} disabled={save.pending}>
              <Check size={16} aria-hidden />
              C&apos;est correct
            </Button>
            <Button variant="white" size="sm" onClick={() => setEditing(true)}>
              Modifier
            </Button>
          </div>
          <FormError message={save.error} className="mt-2" />
        </div>
      )}

      <Informations document={document} />
      <Deadlines document={document} />

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={() => setEditing(true)} className="justify-start">
          <Pencil size={16} aria-hidden />
          Modifier la fiche
        </Button>
        <ConfirmButton
          question="Supprimer ce document ? Le fichier, ses informations et ses échéances seront définitivement effacés."
          confirmLabel="Supprimer"
          pending={remove.pending}
          onConfirm={async () => {
            const ok = await remove.run(() => deleteDocument(document));
            if (!ok) return;
            closeSheet();
            showToast("Document supprimé");
          }}
        >
          <Trash2 size={16} aria-hidden />
          Supprimer le document
        </ConfirmButton>
        <FormError message={remove.error} />
      </div>
    </div>
  );
}

/** Fiche d'un document : consulter, télécharger, informations à valider, échéances, modifier, supprimer. */
export function DocumentSheet() {
  const { sheet, sheetOpen, sheetSession, closeSheet } = useDocuments();
  const active = sheet?.type === "document" ? sheet : null;
  return (
    <Sheet open={sheetOpen && active !== null} onClose={closeSheet} title="Document">
      {active && <DocumentDetail key={sheetSession} documentId={active.documentId} />}
    </Sheet>
  );
}
