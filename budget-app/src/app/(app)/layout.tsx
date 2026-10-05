import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

/** Pages de l'application (protégées par le proxy quand Supabase est configuré). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
