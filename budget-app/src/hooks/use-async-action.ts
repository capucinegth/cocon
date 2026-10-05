"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/services/repository";

/**
 * Enregistrement depuis un formulaire : état « en cours », message d'erreur lisible.
 * En cas d'échec, le formulaire reste ouvert avec la saisie intacte.
 */
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    setPending(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { pending, error, run, clearError: () => setError(null) };
}
