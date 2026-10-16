import type { ReactNode } from "react";
import { AdminFab } from "@/features/administratif/admin-fab";
import { DocumentSheet } from "@/features/administratif/document-sheet";
import { DocumentsGate } from "@/features/administratif/documents-gate";
import { ImportSheet } from "@/features/administratif/import-sheet";
import { DocumentsProvider } from "@/store/documents-store";

/** Module « Mes papiers » : ses données ne sont chargées qu'ici, sans toucher au Budget. */
export default function AdministratifLayout({ children }: { children: ReactNode }) {
  return (
    <DocumentsProvider>
      <DocumentsGate>{children}</DocumentsGate>
      <AdminFab />
      <ImportSheet />
      <DocumentSheet />
    </DocumentsProvider>
  );
}
