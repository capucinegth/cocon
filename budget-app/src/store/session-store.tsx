"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dataSource, type DataSource } from "@/lib/supabase/env";

export interface SessionUser {
  id: string;
  email?: string;
}

interface SessionContextValue {
  source: DataSource;
  user: SessionUser | null;
  signOut: () => Promise<void>;
  /** Session expirée ou révoquée : retour à la connexion, en gardant la page en cours. */
  handleSessionExpired: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function leaveTo(path: string) {
  // Rechargement complet : aucune donnée de l'utilisateur précédent ne reste en mémoire.
  window.location.replace(path);
}

const demoSession: SessionContextValue = {
  source: "demo",
  user: null,
  signOut: async () => {},
  handleSessionExpired: () => {},
};

function SupabaseSessionProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseBrowserClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const signingOut = useRef(false);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        leaveTo(signingOut.current ? "/connexion?raison=deconnexion" : "/connexion?raison=session");
        return;
      }
      const next = session?.user;
      if (!next) return;
      // Un autre compte s'est connecté dans un autre onglet : on ne mélange jamais deux comptes.
      if (userId.current && userId.current !== next.id) {
        window.location.reload();
        return;
      }
      userId.current = next.id;
      setUser((current) => (current?.id === next.id && current.email === next.email ? current : { id: next.id, email: next.email ?? undefined }));
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    await client.auth.signOut({ scope: "local" });
    leaveTo("/connexion?raison=deconnexion");
  }, [client]);

  const handleSessionExpired = useCallback(() => {
    const here = window.location.pathname + window.location.search;
    leaveTo(`/connexion?raison=session${here !== "/" ? `&suite=${encodeURIComponent(here)}` : ""}`);
  }, []);

  const value = useMemo(() => ({ source: "supabase" as const, user, signOut, handleSessionExpired }), [user, signOut, handleSessionExpired]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  if (dataSource === "demo") return <SessionContext.Provider value={demoSession}>{children}</SessionContext.Provider>;
  return <SupabaseSessionProvider>{children}</SupabaseSessionProvider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession doit être utilisé dans <SessionProvider>.");
  return context;
}
