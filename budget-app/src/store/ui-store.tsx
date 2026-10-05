"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Transaction, TransactionKind } from "@/types/finance";

export interface AddPreset {
  kind?: TransactionKind;
  goalId?: string;
}

/** Une seule feuille modale ouverte à la fois. */
export type SheetState =
  | { type: "add"; preset: AddPreset }
  | { type: "transaction"; transaction: Transaction }
  | { type: "category" }
  | { type: "goal" }
  | null;

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UIContextValue {
  /** Dernière feuille ouverte : son contenu reste affiché pendant l'animation de fermeture. */
  sheet: SheetState;
  isSheetOpen: boolean;
  /** Change à chaque ouverture : remet les formulaires à zéro. */
  sheetSession: number;
  openAdd: (preset?: AddPreset) => void;
  openTransaction: (transaction: Transaction) => void;
  openCategorySheet: () => void;
  openGoalSheet: () => void;
  closeSheet: () => void;
  toast: Toast | null;
  showToast: (message: string, action?: { label: string; onAction: () => void }) => void;
  dismissToast: () => void;
  /** Dernière opération ajoutée : mise en évidence quelques secondes. */
  highlightId: string | null;
  highlight: (id: string) => void;
  /** Mode discret : montants floutés. */
  discreet: boolean;
  setDiscreet: (value: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [sheetSession, setSheetSession] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [discreet, setDiscreet] = useState(false);

  const open = useCallback((next: Exclude<SheetState, null>) => {
    setSheetSession((n) => n + 1);
    setSheet(next);
    setSheetOpen(true);
  }, []);

  const openAdd = useCallback((preset: AddPreset = {}) => open({ type: "add", preset }), [open]);
  const openTransaction = useCallback((transaction: Transaction) => open({ type: "transaction", transaction }), [open]);
  const openCategorySheet = useCallback(() => open({ type: "category" }), [open]);
  const openGoalSheet = useCallback(() => open({ type: "goal" }), [open]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const showToast = useCallback((message: string, action?: { label: string; onAction: () => void }) => {
    setToast({ id: Date.now(), message, actionLabel: action?.label, onAction: action?.onAction });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  const highlight = useCallback((id: string) => setHighlightId(id), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? 5000 : 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-discreet", discreet);
  }, [discreet]);

  const value = useMemo(
    () => ({
      sheet,
      isSheetOpen,
      sheetSession,
      openAdd,
      openTransaction,
      openCategorySheet,
      openGoalSheet,
      closeSheet,
      toast,
      showToast,
      dismissToast,
      highlightId,
      highlight,
      discreet,
      setDiscreet,
    }),
    [sheet, isSheetOpen, sheetSession, openAdd, openTransaction, openCategorySheet, openGoalSheet, closeSheet, toast, showToast, dismissToast, highlightId, highlight, discreet],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI doit être utilisé dans <UIProvider>.");
  return context;
}
