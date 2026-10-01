"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
}

interface UIContextValue {
  isAddOpen: boolean;
  /** Change à chaque ouverture : remet le formulaire d'ajout à zéro. */
  addSession: number;
  openAdd: () => void;
  closeAdd: () => void;
  toast: Toast | null;
  showToast: (message: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isAddOpen, setAddOpen] = useState(false);
  const [addSession, setAddSession] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const openAdd = useCallback(() => {
    setAddSession((n) => n + 1);
    setAddOpen(true);
  }, []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const showToast = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(
    () => ({ isAddOpen, addSession, openAdd, closeAdd, toast, showToast }),
    [isAddOpen, addSession, openAdd, closeAdd, toast, showToast],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI doit être utilisé dans <UIProvider>.");
  return context;
}
