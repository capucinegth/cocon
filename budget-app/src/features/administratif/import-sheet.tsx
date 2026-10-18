"use client";

import { ArrowLeft, ArrowRight, Camera, Crop, FileText, Images, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { ACCEPTED_FILE_TYPES, categoryInfo, typeInfo } from "@/lib/admin/catalog";
import { classifyFileName, titleFromFileName, type Classification } from "@/lib/admin/classify";
import { checkFinalSize, checkSelectedFile, storageFileName } from "@/lib/admin/files";
import { formatDocDate } from "@/lib/admin/documents";
import type { Quad, ScanMode } from "@/lib/admin/scan";
import { useAsyncAction } from "@/hooks/use-async-action";
import { RepositoryError } from "@/services/repository";
import { useDocuments } from "@/store/documents-store";
import { useUI } from "@/store/ui-store";
import type { DocumentField } from "@/types/documents";
import { DocumentForm, emptyValues, formProblem, toDocumentFields, valuesFromClassification, type DocumentFormValues } from "./document-form";
import { initialQuad, pagesToPdf, PhotoError, preparePhoto, readHead, releasePages, releaseSource, scanPage, type PhotoPage, type ScanSource } from "./photo-pipeline";
import { ScanEditor } from "./scan-editor";

type Source = { kind: "photos"; pages: PhotoPage[] } | { kind: "pdf"; file: File; url: string };

/**
 * Détourage en cours : les nouvelles photos, une par une (à la place d'une page si « Reprendre »),
 * ou une page déjà ajoutée (« Recadrer »).
 */
type Editing =
  | { kind: "new"; queue: ScanSource[]; total: number; replaceIndex: number | null; classification: Classification | null; fallbackTitle: string }
  | { kind: "page"; index: number };

/** Taille maximale d'une photo AVANT préparation (elle est ensuite réduite) : protège l'appareil. */
const MAX_RAW_PHOTO_BYTES = 60 * 1024 * 1024;

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/** Informations proposées d'après le nom du fichier (période), à vérifier dans la fiche du document. */
function proposedFields(classification: Classification | null): Omit<DocumentField, "id" | "documentId">[] {
  if (!classification?.periodYear) return [];
  const fields = typeInfo(classification.type, classification.category).fields;
  if (classification.periodMonth && fields.includes("mois")) {
    return [{ key: "mois", date: `${classification.periodYear}-${String(classification.periodMonth).padStart(2, "0")}-01`, status: "propose", source: "nom_fichier" }];
  }
  if (fields.includes("annee")) return [{ key: "annee", date: `${classification.periodYear}-01-01`, status: "propose", source: "nom_fichier" }];
  return [];
}

function ImportForm({ presetFolderId }: { presetFolderId?: string }) {
  const { today, folders, importDocument, closeSheet } = useDocuments();
  const { showToast } = useUI();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [values, setValues] = useState<DocumentFormValues>(emptyValues("", presetFolderId));
  const [classification, setClassification] = useState<Classification | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  /** Dernier rendu choisi : proposé pour les pages suivantes. */
  const [lastMode, setLastMode] = useState<ScanMode>("document");
  /** Page à remplacer par la prochaine photo (« Reprendre la photo »). */
  const replaceAt = useRef<number | null>(null);
  const save = useAsyncAction();

  // Aucun aperçu local ne survit à la feuille : les liens blob: sont révoqués à la fermeture.
  const sourceRef = useRef(source);
  const editingRef = useRef(editing);
  useEffect(() => {
    sourceRef.current = source;
    editingRef.current = editing;
  }, [source, editing]);
  useEffect(
    () => () => {
      const current = sourceRef.current;
      if (current?.kind === "photos") releasePages(current.pages);
      if (current?.kind === "pdf") URL.revokeObjectURL(current.url);
      const pending = editingRef.current;
      if (pending?.kind === "new") pending.queue.forEach(releaseSource);
    },
    [],
  );

  const pages = source?.kind === "photos" ? source.pages : [];

  function reset() {
    if (source?.kind === "photos") releasePages(source.pages);
    if (source?.kind === "pdf") URL.revokeObjectURL(source.url);
    setSource(null);
    setValues(emptyValues("", presetFolderId));
    setClassification(null);
    setProblem(null);
    setPreview(null);
    if (editing?.kind === "new") editing.queue.forEach(releaseSource);
    setEditing(null);
    setScanError(null);
    save.clearError();
  }

  /** Nouvelles photos : préparées et analysées sur l'appareil, puis détourées une par une. */
  async function addPhotos(files: File[]) {
    if (files.length === 0) return;
    setProblem(null);
    setPreparing(true);
    const prepared: ScanSource[] = [];
    try {
      for (const file of files) {
        if (file.size > MAX_RAW_PHOTO_BYTES) throw new PhotoError("Cette photo est trop lourde pour être préparée ici.");
        const check = checkSelectedFile({ size: 1 }, await readHead(file));
        if (!check.ok || check.kind !== "image") throw new PhotoError("Ce fichier n'est pas une photo. Choisis une image (JPEG, PNG, WebP ou HEIC).");
        prepared.push(await preparePhoto(file));
      }
      const index = replaceAt.current;
      setScanError(null);
      setEditing({
        kind: "new",
        queue: prepared,
        total: prepared.length,
        replaceIndex: index !== null && pages[index] ? index : null,
        classification: files.length === 1 ? classifyFileName(files[0].name, today) : null,
        fallbackTitle: `Document du ${formatDocDate(today)}`,
      });
    } catch (error) {
      prepared.forEach(releaseSource);
      setProblem(error instanceof PhotoError ? error.message : "Cette photo n'a pas pu être préparée. Réessaie.");
    } finally {
      replaceAt.current = null;
      setPreparing(false);
    }
  }

  /** Page détourée validée : ajoutée (ou mise à la place de celle à reprendre / recadrer). */
  async function confirmScan(quad: Quad, mode: ScanMode) {
    if (!editing) return;
    setScanning(true);
    setScanError(null);
    try {
      setLastMode(mode);
      if (editing.kind === "page") {
        const old = pages[editing.index];
        const page = await scanPage(old.source, quad, mode, old.id);
        URL.revokeObjectURL(old.url);
        setSource({ kind: "photos", pages: pages.map((p, i) => (i === editing.index ? page : p)) });
        setEditing(null);
        return;
      }
      const [current, ...rest] = editing.queue;
      const page = await scanPage(current, quad, mode);
      let next: PhotoPage[];
      if (editing.replaceIndex !== null && pages[editing.replaceIndex]) {
        const old = pages[editing.replaceIndex];
        releasePages([old]);
        next = pages.map((p, i) => (i === editing.replaceIndex ? page : p));
      } else {
        next = [...pages, page];
      }
      if (source?.kind !== "photos") {
        // Première page : le PDF éventuellement choisi avant est remplacé, le classement repart du nom de la photo.
        if (source?.kind === "pdf") URL.revokeObjectURL(source.url);
        setClassification(editing.classification);
        const next = editing.classification ? valuesFromClassification(editing.classification) : emptyValues(editing.fallbackTitle);
        setValues({ ...next, folderId: values.folderId });
      }
      setSource({ kind: "photos", pages: next });
      setEditing(rest.length > 0 ? { ...editing, queue: rest, replaceIndex: null } : null);
    } catch (error) {
      setScanError(error instanceof PhotoError ? error.message : "Cette page n'a pas pu être scannée. Réessaie.");
    } finally {
      setScanning(false);
    }
  }

  /** Photo écartée (ou recadrage abandonné) : rien ne change dans les pages. */
  function cancelScan() {
    setScanError(null);
    if (editing?.kind === "new") {
      const [current, ...rest] = editing.queue;
      releaseSource(current);
      setEditing(rest.length > 0 ? { ...editing, queue: rest } : null);
      return;
    }
    setEditing(null);
  }

  function retakeFromEditor() {
    if (editing?.kind !== "new") return;
    const replaceIndex = editing.replaceIndex;
    editing.queue.forEach(releaseSource);
    setEditing(null);
    setScanError(null);
    replaceAt.current = replaceIndex;
    cameraInput.current?.click();
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    const check = checkSelectedFile(file, await readHead(file));
    if (!check.ok) return setProblem(check.reason);
    if (check.kind === "image") return addPhotos([file]);
    if (source?.kind === "photos") releasePages(source.pages);
    if (source?.kind === "pdf") URL.revokeObjectURL(source.url);
    const fromName = classifyFileName(file.name, today);
    setClassification(fromName);
    setValues({ ...(fromName ? valuesFromClassification(fromName) : emptyValues(titleFromFileName(file.name))), folderId: values.folderId });
    setSource({ kind: "pdf", file, url: URL.createObjectURL(file) });
  }

  function movePage(index: number, delta: number) {
    if (source?.kind !== "photos") return;
    const next = [...source.pages];
    const [page] = next.splice(index, 1);
    next.splice(index + delta, 0, page);
    setSource({ kind: "photos", pages: next });
  }

  function removePage(index: number) {
    if (source?.kind !== "photos") return;
    releasePages([source.pages[index]]);
    const next = source.pages.filter((_, i) => i !== index);
    setPreview(null);
    if (next.length === 0) return reset();
    setSource({ kind: "photos", pages: next });
  }

  function retake(index: number) {
    replaceAt.current = index;
    cameraInput.current?.click();
  }

  const formError = formProblem(values);
  const canSave = source !== null && !formError && !save.pending && !preparing && !editing;
  const suggestionKept = classification !== null && values.category === classification.category && values.type === classification.type;

  async function handleSave() {
    if (!source || formError) return;
    const ok = await save.run(async () => {
      const file = source.kind === "photos" ? await pagesToPdf(source.pages) : source.file;
      const tooBig = checkFinalSize(file.size);
      if (tooBig) throw new RepositoryError(tooBig, "validation");
      const fields = toDocumentFields(values);
      const document = await importDocument(
        {
          ...fields,
          fileName: source.kind === "photos" ? storageFileName(fields.title, "pdf") : source.file.name.slice(0, 200),
          mimeType: "application/pdf",
          fileSize: file.size,
          pageCount: source.kind === "photos" ? source.pages.length : undefined,
          // L'utilisateur a vu et validé la catégorie et le type avant d'enregistrer.
          classificationStatus: "confirme",
          classificationSource: suggestionKept ? "nom_fichier" : "utilisateur",
        },
        file,
        suggestionKept ? proposedFields(classification) : [],
      );
      const folder = document.folderId ? folders.find((f) => f.id === document.folderId) : undefined;
      showToast(`« ${document.title} » ajouté dans ${folder ? `${categoryInfo(document.category).label} et « ${folder.name} »` : categoryInfo(document.category).label}`);
    });
    if (!ok) return;
    reset();
    closeSheet();
  }

  const inputs = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="document-camera"
        onChange={(event) => {
          void addPhotos([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="document-gallery"
        onChange={(event) => {
          void addPhotos([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="document-file"
        onChange={(event) => {
          void chooseFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </>
  );

  if (editing) {
    const target = editing.kind === "new" ? editing.queue[0] : pages[editing.index].source;
    const page = editing.kind === "page" ? pages[editing.index] : null;
    const position = editing.kind === "new" ? editing.total - editing.queue.length + 1 : 0;
    return (
      <>
        {inputs}
        <ScanEditor
          key={page ? `${page.id}-${page.url}` : target.url}
          source={target}
          initialQuad={page ? page.quad : initialQuad(target)}
          initialMode={page ? page.mode : lastMode}
          progress={editing.kind === "new" && editing.total > 1 ? `Photo ${position} sur ${editing.total}` : undefined}
          busy={scanning}
          error={scanError}
          confirmLabel={editing.kind === "page" ? "Valider" : editing.replaceIndex !== null ? "Remplacer la page" : "Valider la page"}
          cancelLabel={editing.kind === "page" ? "Annuler" : "Écarter"}
          onConfirm={(quad, mode) => void confirmScan(quad, mode)}
          onCancel={cancelScan}
          onRetake={editing.kind === "new" ? retakeFromEditor : undefined}
        />
      </>
    );
  }

  if (!source) {
    return (
      <div className="flex flex-col gap-3 px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">
        {inputs}
        <p className="text-[15px] text-muted">
          Une photo de chaque page : Cocon détoure la feuille et la redresse comme un scanner. Ou un fichier déjà sur ton téléphone. Rien n&apos;est envoyé avant que tu
          confirmes.
        </p>
        <Button size="lg" className="w-full" onClick={() => cameraInput.current?.click()} disabled={preparing} data-autofocus>
          <Camera size={20} aria-hidden />
          Prendre une photo
        </Button>
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <Button variant="soft" size="lg" className="w-full" onClick={() => galleryInput.current?.click()} disabled={preparing}>
            <Images size={19} aria-hidden />
            Choisir une photo
          </Button>
          <Button variant="soft" size="lg" className="w-full" onClick={() => fileInput.current?.click()} disabled={preparing}>
            <FileText size={19} aria-hidden />
            Choisir un fichier
          </Button>
        </div>
        <p className="text-[13px] text-muted">PDF ou photo (JPEG, PNG, WebP, HEIC), 20 Mo au plus.</p>
        {preparing && (
          <p role="status" className="text-[14px] font-medium text-ink-soft">
            Préparation de la photo…
          </p>
        )}
        <FormError message={problem} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {inputs}
      <div className="flex flex-col gap-6 px-6 pb-6 pt-2">
        {source.kind === "photos" ? (
          <section aria-labelledby="pages-title">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h3 id="pages-title" className="text-sm font-semibold text-muted">
                Aperçu · {pages.length} page{pages.length > 1 ? "s" : ""}
              </h3>
              <span className="text-[13px] text-muted">Touche une page pour l&apos;agrandir</span>
            </div>
            {preview !== null && pages[preview] ? (
              <figure className="relative rounded-3xl bg-canvas p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
                <img src={pages[preview].url} alt={`Page ${preview + 1} sur ${pages.length}`} className="mx-auto max-h-[55vh] w-auto rounded-2xl object-contain" />
                <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-medium text-ink-soft">
                  Page {preview + 1}/{pages.length}
                  <Button variant="accent" onClick={() => setEditing({ kind: "page", index: preview })}>
                    <Crop size={17} aria-hidden />
                    Recadrer
                  </Button>
                </figcaption>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  aria-label="Fermer l'aperçu"
                  className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-surface/90 shadow-sm"
                >
                  <X size={18} aria-hidden />
                </button>
              </figure>
            ) : (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pages.map((page, index) => (
                  <li key={page.id} className="flex min-w-0 flex-col gap-1.5 rounded-3xl bg-canvas p-2">
                    <div className="relative">
                      <button type="button" onClick={() => setPreview(index)} className="block w-full overflow-hidden rounded-2xl bg-surface" aria-label={`Agrandir la page ${index + 1}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
                        <img src={page.url} alt="" className="aspect-[3/4] w-full object-contain" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ kind: "page", index })}
                        aria-label={`Recadrer la page ${index + 1}`}
                        className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full bg-surface/90 text-ink shadow-sm hover:bg-surface"
                      >
                        <Crop size={17} aria-hidden />
                      </button>
                    </div>
                    <p className="text-center text-[13px] font-semibold">
                      Page {index + 1}/{pages.length}
                    </p>
                    <div className="flex flex-wrap justify-center gap-0.5">
                      <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} aria-label={`Placer la page ${index + 1} avant`} className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-blush-50 disabled:opacity-30">
                        <ArrowLeft size={17} aria-hidden />
                      </button>
                      {pages.length === 1 ? (
                        <button type="button" onClick={() => retake(index)} aria-label="Reprendre la photo" className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-blush-50">
                          <RotateCcw size={17} aria-hidden />
                        </button>
                      ) : (
                        <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} aria-label={`Placer la page ${index + 1} après`} className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-blush-50 disabled:opacity-30">
                          <ArrowRight size={17} aria-hidden />
                        </button>
                      )}
                      <button type="button" onClick={() => removePage(index)} aria-label={`Supprimer la page ${index + 1}`} className="grid size-11 place-items-center rounded-full text-blush-700 hover:bg-blush-50">
                        <Trash2 size={17} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Button variant="soft" onClick={() => cameraInput.current?.click()} disabled={preparing} className="w-full">
                <Plus size={18} aria-hidden />
                Ajouter une page
              </Button>
              <Button variant="ghost" onClick={() => galleryInput.current?.click()} disabled={preparing} className="w-full">
                <Images size={18} aria-hidden />
                Depuis mes photos
              </Button>
            </div>
            {preparing && (
              <p role="status" className="mt-2 text-[14px] font-medium text-ink-soft">
                Préparation de la photo…
              </p>
            )}
          </section>
        ) : (
          <section aria-label="Fichier choisi" className="flex items-center gap-3 rounded-3xl bg-canvas p-4">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface">
              <FileText size={22} className="text-ink-soft" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-all text-[15px] font-semibold">{source.file.name}</span>
              <span className="block text-[13px] text-muted">PDF · {sizeLabel(source.file.size)}</span>
            </span>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-blush-700 hover:bg-blush-50">
              Aperçu
            </a>
          </section>
        )}
        <FormError message={problem} />

        {classification && (
          <p className="rounded-2xl bg-lilac-50 px-4 py-3 text-[13px] text-ink-soft">Classement proposé d&apos;après le nom du fichier : vérifie-le avant d&apos;enregistrer.</p>
        )}
        <DocumentForm values={values} onChange={setValues} today={today} />
      </div>

      <div className="sticky bottom-0 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        <FormError message={save.error} className="mb-3" />
        <div className="flex gap-3">
          <Button variant="ghost" onClick={reset} disabled={save.pending} className={cn("shrink-0")}>
            Annuler
          </Button>
          <Button size="lg" onClick={() => void handleSave()} disabled={!canSave} className="flex-1" aria-busy={save.pending || undefined}>
            {save.pending ? "Enregistrement…" : formError && !values.category ? "Choisis une catégorie" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** « Ajouter un document » : prendre une photo (plusieurs pages possibles), choisir une photo ou un fichier. */
export function ImportSheet() {
  const { sheet, sheetOpen, sheetSession, closeSheet } = useDocuments();
  const active = sheet?.type === "import" ? sheet : null;
  return (
    <Sheet open={sheetOpen && active !== null} onClose={closeSheet} title="Ajouter un document">
      {active && <ImportForm key={sheetSession} presetFolderId={active.folderId} />}
    </Sheet>
  );
}
