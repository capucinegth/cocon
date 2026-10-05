"use client";

import { useEffect } from "react";

/** Active le service worker (application installable, page hors connexion). Production uniquement. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sans service worker, Cocon fonctionne normalement (simplement sans page hors connexion).
    });
  }, []);
  return null;
}
