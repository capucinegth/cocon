"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Transaction, TransactionKind } from "@/types/finance";

export interface AddPreset {
  kind?: TransactionKind;
  goalId?: string;
  /** Opération à modifier (sinon : nouvelle opération). */
  transaction?: Transaction;
}

/** Une seule feuille modale ouverte à la fois. */
export type SheetState =
  | { type: "add"; preset: AddPreset }
  | { type: "transaction"; transaction: Transaction }
  | { type: "category" }
  | { type: "categoryEdit"; categoryId: string; month: string }
  | { type: "goal"; goalId?: string }
  | { type: "recurring"; ruleId: string }
  | { type: "fixedCharge" }
  | { type: "targets"; month: string }
  | { type: "profile" }
  | { type: "account"; accountId?: string }
  | { type: "password"; recovery: boolean }
  | null;

export type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
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
  openCategoryEdit: (categoryId: string, month: string) => void;
  /** Sans identifiant : nouvel objectif ; avec : modification. */
  openGoalSheet: (goalId?: string) => void;
  openRecurring: (ruleId: string) => void;
  /** Nouvelle charge fixe récurrente (montant + jour de prélèvement). */
  openFixedCharge: () => void;
  openTargets: (month: string) => void;
  openProfile: () => void;
  /** Sans identifiant : nouveau compte. */
  openAccount: (accountId?: string) => void;
  /** `recovery` : après un lien « mot de passe oublié ». */
  openPassword: (recovery?: boolean) => void;
  closeSheet: () => void;
  toast: Toast | null;
  showToast: (message: string, action?: { label: string; onAction: () => void }) => void;
  /** Message d'erreur (enregistrement impossible, connexion perdue…). */
  showError: (message: string) => void;
  dismissToast: () => void;
  /** Dernière opération ajoutée : mise en évidence quelques secondes. */
  highlightId: string | null;
  highlight: (id: string) => void;
  /** Mode discret : montants floutés. */
  discreet: boolean;
  setDiscreet: (value: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const DISCREET_KEY = "cocon:discreet";

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
  const openCategoryEdit = useCallback((categoryId: string, month: string) => open({ type: "categoryEdit", categoryId, month }), [open]);
  const openGoalSheet = useCallback((goalId?: string) => open({ type: "goal", goalId }), [open]);
  const openRecurring = useCallback((ruleId: string) => open({ type: "recurring", ruleId }), [open]);
  const openFixedCharge = useCallback(() => open({ type: "fixedCharge" }), [open]);
  const openTargets = useCallback((month: string) => open({ type: "targets", month }), [open]);
  const openProfile = useCallback(() => open({ type: "profile" }), [open]);
  const openAccount = useCallback((accountId?: string) => open({ type: "account", accountId }), [open]);
  const openPassword = useCallback((recovery = false) => open({ type: "password", recovery }), [open]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const showToast = useCallback((message: string, action?: { label: string; onAction: () => void }) => {
    setToast({ id: Date.now(), message, tone: "success", actionLabel: action?.label, onAction: action?.onAction });
  }, []);
  const showError = useCallback((message: string) => setToast({ id: Date.now(), message, tone: "error" }), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const highlight = useCallback((id: string) => setHighlightId(id), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? 5000 : toast.tone === "error" ? 6000 : 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  // Mode discret : retenu sur cet appareil (appliqué avant l'affichage, voir layout.tsx)
  // et, avec un compte, enregistré dans les préférences du profil.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(DISCREET_KEY) === "1") setDiscreet(true);
    } catch {
      // Stockage indisponible (navigation privée) : sans conséquence.
    }
  }, []);

  const firstSync = useRef(true);
  useEffect(() => {
    // Premier passage : le script du layout a déjà appliqué la valeur enregistrée, on n'y touche pas.
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    document.documentElement.toggleAttribute("data-discreet", discreet);
    try {
      window.localStorage.setItem(DISCREET_KEY, discreet ? "1" : "0");
    } catch {
      // Stockage indisponible : le mode discret reste actif pour cette visite.
    }
  }, [discreet]);

  const value = useMemo(
    () => ({
      sheet,
      isSheetOpen,
      sheetSession,
      openAdd,
      openTransaction,
      openCategorySheet,
      openCategoryEdit,
      openGoalSheet,
      openRecurring,
      openFixedCharge,
      openTargets,
      openProfile,
      openAccount,
      openPassword,
      closeSheet,
      toast,
      showToast,
      showError,
      dismissToast,
      highlightId,
      highlight,
      discreet,
      setDiscreet,
    }),
    [
      sheet,
      isSheetOpen,
      sheetSession,
      openAdd,
      openTransaction,
      openCategorySheet,
      openCategoryEdit,
      openGoalSheet,
      openRecurring,
      openFixedCharge,
      openTargets,
      openProfile,
      openAccount,
      openPassword,
      closeSheet,
      toast,
      showToast,
      showError,
      dismissToast,
      highlightId,
      highlight,
      discreet,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI doit être utilisé dans <UIProvider>.");
  return context;
}
