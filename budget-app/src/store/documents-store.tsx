"use client";

/**
 * Données du module Administratif (Mes papiers) — store SÉPARÉ du Budget.
 * Monté uniquement dans /administratif : le chargement habituel du Budget n'est ni ralenti ni modifié.
 * Même règle que le reste de Cocon : on enregistre d'abord, puis on affiche ; en cas d'échec,
 * rien ne change à l'écran et l'erreur remonte au formulaire.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fieldDefinitions } from "@/lib/admin/catalog";
import { folderNameProblem } from "@/lib/admin/documents";
import { uuid } from "@/lib/ids";
import { todayInParis } from "@/lib/paris-time";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { appConfig } from "@/config/app";
import { dataSource } from "@/lib/supabase/env";
import { createDemoDocumentRepository } from "@/services/documents/demo-repository";
import type { DocumentDraft, DocumentRepository } from "@/services/documents/repository";
import { createSupabaseDocumentRepository } from "@/services/documents/supabase-repository";
import { errorMessage, isSessionError, RepositoryError } from "@/services/repository";
import { useSession } from "@/store/session-store";
import type { LoadStatus } from "@/store/budget-store";
import type { AdminDocument, AdminState, DocumentDeadline, DocumentField, DocumentFolder } from "@/types/documents";

/** Feuilles du module (une seule ouverte à la fois, indépendantes de celles du Budget). */
export type AdminSheet =
  /** Import, éventuellement directement dans un dossier. */
  | { type: "import"; folderId?: string }
  | { type: "document"; documentId: string }
  /** Nouveau dossier (sans identifiant) ou dossier à renommer / supprimer. */
  | { type: "folder"; folderId?: string }
  | null;

/** Information à enregistrer : sans identifiant pour une nouvelle. */
export type FieldInput = Pick<DocumentField, "documentId" | "key" | "text" | "amount" | "date"> & { validate: boolean };

interface DocumentsContextValue extends AdminState {
  source: DocumentRepository["source"];
  status: LoadStatus;
  loadError: string | null;
  reload: () => Promise<void>;
  importDocument: (draft: Omit<DocumentDraft, "id">, file: Blob, fields: Omit<DocumentField, "id" | "documentId">[]) => Promise<AdminDocument>;
  updateDocument: (document: AdminDocument) => Promise<void>;
  deleteDocument: (document: AdminDocument) => Promise<void>;
  fileUrl: (document: AdminDocument, mode: "view" | "download") => Promise<string>;
  saveField: (input: FieldInput) => Promise<void>;
  validateField: (field: DocumentField) => Promise<void>;
  deleteField: (field: DocumentField) => Promise<void>;
  saveDeadline: (deadline: Omit<DocumentDeadline, "id"> & { id?: string }) => Promise<void>;
  deleteDeadline: (deadline: DocumentDeadline) => Promise<void>;
  saveFolder: (input: { id?: string; name: string; emoji: string }) => Promise<DocumentFolder>;
  deleteFolder: (folder: DocumentFolder) => Promise<void>;
  sheet: AdminSheet;
  sheetOpen: boolean;
  sheetSession: number;
  openSheet: (sheet: Exclude<AdminSheet, null>) => void;
  closeSheet: () => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

function createRepository(): DocumentRepository {
  return dataSource === "supabase" ? createSupabaseDocumentRepository(getSupabaseBrowserClient()) : createDemoDocumentRepository(appConfig.demoToday);
}

const emptyState = (today: string): AdminState => ({ today, documents: [], fields: [], deadlines: [], folders: [] });

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { handleSessionExpired } = useSession();
  const [repository] = useState(createRepository);
  const [state, setState] = useState<AdminState>(() => emptyState(repository.source === "demo" ? appConfig.demoToday : todayInParis()));
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<AdminSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSession, setSheetSession] = useState(0);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const today = repository.source === "demo" ? appConfig.demoToday : todayInParis();
      setState(await repository.load(today));
      setStatus("ready");
      setLoadError(null);
    } catch (error) {
      if (isSessionError(error)) return handleSessionExpired();
      setLoadError(errorMessage(error));
      setStatus("error");
    }
  }, [repository, handleSessionExpired]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    // Chargement des documents, une fois, à l'entrée dans le module.
    void load();
  }, [load]);

  /** Enregistre puis applique ; rien n'est modifié à l'écran si l'enregistrement échoue. */
  const commit = useCallback(
    async <T,>(persist: () => Promise<T>, apply: (current: AdminState, result: T) => AdminState): Promise<T> => {
      let result: T;
      try {
        result = await persist();
      } catch (error) {
        if (isSessionError(error)) handleSessionExpired();
        throw error;
      }
      setState((current) => apply(current, result));
      return result;
    },
    [handleSessionExpired],
  );

  const importDocument = useCallback<DocumentsContextValue["importDocument"]>(
    (draft, file, fields) => {
      const id = uuid();
      const withIds = fields.map((f) => ({ ...f, id: uuid(), documentId: id }));
      return commit(
        () => repository.createDocument({ ...draft, id }, file, withIds),
        (current, document) => ({ ...current, documents: [document, ...current.documents], fields: [...current.fields, ...withIds] }),
      );
    },
    [commit, repository],
  );

  const updateDocument = useCallback(
    (document: AdminDocument) =>
      commit(
        () => repository.updateDocument(document),
        (current) => ({ ...current, documents: current.documents.map((d) => (d.id === document.id ? document : d)) }),
      ),
    [commit, repository],
  );

  const deleteDocument = useCallback(
    (document: AdminDocument) =>
      commit(
        () => repository.deleteDocument(document),
        (current) => ({
          ...current,
          documents: current.documents.filter((d) => d.id !== document.id),
          fields: current.fields.filter((f) => f.documentId !== document.id),
          deadlines: current.deadlines.filter((d) => d.documentId !== document.id),
        }),
      ),
    [commit, repository],
  );

  const fileUrl = useCallback(
    async (document: AdminDocument, mode: "view" | "download") => {
      try {
        return await repository.fileUrl(document, mode);
      } catch (error) {
        if (isSessionError(error)) handleSessionExpired();
        throw error;
      }
    },
    [repository, handleSessionExpired],
  );

  const putField = useCallback(
    (field: DocumentField) =>
      commit(
        () => repository.saveField(field),
        (current) => ({
          ...current,
          fields: [...current.fields.filter((f) => !(f.documentId === field.documentId && f.key === field.key)), field],
        }),
      ),
    [commit, repository],
  );

  const saveField = useCallback(
    async (input: FieldInput) => {
      const definition = fieldDefinitions[input.key];
      if (!definition) throw new RepositoryError("Information inconnue.", "validation");
      const empty = definition.kind === "amount" ? input.amount === undefined || Number.isNaN(input.amount) : definition.kind === "text" ? !input.text?.trim() : !input.date;
      if (empty) throw new RepositoryError("Renseigne une valeur.", "validation");
      const existing = state.fields.find((f) => f.documentId === input.documentId && f.key === input.key);
      await putField({
        id: existing?.id ?? uuid(),
        documentId: input.documentId,
        key: input.key,
        text: definition.kind === "text" ? input.text?.trim() : undefined,
        amount: definition.kind === "amount" ? input.amount : undefined,
        date: ["date", "month", "year"].includes(definition.kind) ? input.date : undefined,
        status: input.validate ? "valide" : "propose",
        source: "utilisateur",
        validatedAt: input.validate ? new Date().toISOString() : undefined,
      });
    },
    [putField, state.fields],
  );

  const validateField = useCallback(
    (field: DocumentField) => putField({ ...field, status: "valide", validatedAt: new Date().toISOString() }),
    [putField],
  );

  const deleteField = useCallback(
    (field: DocumentField) =>
      commit(
        () => repository.deleteField(field),
        (current) => ({ ...current, fields: current.fields.filter((f) => f.id !== field.id) }),
      ),
    [commit, repository],
  );

  const saveDeadline = useCallback<DocumentsContextValue["saveDeadline"]>(
    (input) => {
      if (!input.label.trim()) return Promise.reject(new RepositoryError("Donne un nom à cette échéance.", "validation"));
      if (!input.dueDate) return Promise.reject(new RepositoryError("Choisis une date.", "validation"));
      const deadline: DocumentDeadline = { ...input, id: input.id ?? uuid(), label: input.label.trim() };
      return commit(
        () => repository.saveDeadline(deadline),
        (current) => ({ ...current, deadlines: [...current.deadlines.filter((d) => d.id !== deadline.id), deadline] }),
      );
    },
    [commit, repository],
  );

  const deleteDeadline = useCallback(
    (deadline: DocumentDeadline) =>
      commit(
        () => repository.deleteDeadline(deadline.id),
        (current) => ({ ...current, deadlines: current.deadlines.filter((d) => d.id !== deadline.id) }),
      ),
    [commit, repository],
  );

  const saveFolder = useCallback<DocumentsContextValue["saveFolder"]>(
    (input) => {
      const problem = folderNameProblem(input.name, state.folders, input.id);
      if (problem) return Promise.reject(new RepositoryError(problem, "validation"));
      const existing = input.id ? state.folders.find((f) => f.id === input.id) : undefined;
      const folder: DocumentFolder = { id: input.id ?? uuid(), name: input.name.trim(), emoji: input.emoji, createdAt: existing?.createdAt ?? new Date().toISOString() };
      return commit(
        () => repository.saveFolder(folder),
        (current, saved) => ({ ...current, folders: [...current.folders.filter((f) => f.id !== saved.id), saved] }),
      );
    },
    [commit, repository, state.folders],
  );

  /** Le dossier disparaît ; ses documents restent, simplement sortis du dossier. */
  const deleteFolder = useCallback(
    (folder: DocumentFolder) =>
      commit(
        () => repository.deleteFolder(folder.id),
        (current) => ({
          ...current,
          folders: current.folders.filter((f) => f.id !== folder.id),
          documents: current.documents.map((d) => (d.folderId === folder.id ? { ...d, folderId: undefined } : d)),
        }),
      ),
    [commit, repository],
  );

  const openSheet = useCallback((next: Exclude<AdminSheet, null>) => {
    setSheetSession((n) => n + 1);
    setSheet(next);
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo<DocumentsContextValue>(
    () => ({
      ...state,
      source: repository.source,
      status,
      loadError,
      reload: load,
      importDocument,
      updateDocument,
      deleteDocument,
      fileUrl,
      saveField,
      validateField,
      deleteField,
      saveDeadline,
      deleteDeadline,
      saveFolder,
      deleteFolder,
      sheet,
      sheetOpen,
      sheetSession,
      openSheet,
      closeSheet,
    }),
    [
      state,
      repository.source,
      status,
      loadError,
      load,
      importDocument,
      updateDocument,
      deleteDocument,
      fileUrl,
      saveField,
      validateField,
      deleteField,
      saveDeadline,
      deleteDeadline,
      saveFolder,
      deleteFolder,
      sheet,
      sheetOpen,
      sheetSession,
      openSheet,
      closeSheet,
    ],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocuments(): DocumentsContextValue {
  const context = useContext(DocumentsContext);
  if (!context) throw new Error("useDocuments doit être utilisé dans <DocumentsProvider>.");
  return context;
}
