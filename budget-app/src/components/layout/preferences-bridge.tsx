"use client";

import { useEffect } from "react";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

/** Applique les préférences enregistrées dans le profil (mode discret) dès leur chargement. */
export function PreferencesBridge() {
  const { profile } = useBudget();
  const { setDiscreet } = useUI();
  const saved = profile?.preferences.discreet;

  useEffect(() => {
    if (saved !== undefined) setDiscreet(saved);
  }, [saved, setDiscreet]);

  return null;
}
