"use client";

import { useEffect, useRef } from "react";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/**
 * Ouvre le tuto à la première visite d'un compte (préférence `tutorialSeen` absente du profil).
 * Une seule fois par visite, et jamais par-dessus une autre feuille (mot de passe à réinitialiser…).
 */
export function TutorialBridge() {
  const { status, profile } = useBudget();
  const { sheet, isSheetOpen, openTutorial } = useUI();
  const opened = useRef(false);
  const shouldOpen = status === "ready" && profile !== null && profile.preferences.tutorialSeen !== true;

  useEffect(() => {
    if (!shouldOpen || opened.current || (isSheetOpen && sheet !== null)) return;
    opened.current = true;
    openTutorial();
  }, [shouldOpen, isSheetOpen, sheet, openTutorial]);

  return null;
}
