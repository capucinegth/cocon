import type { ReactNode } from "react";
import { AddTransactionSheet } from "@/features/transactions/add-transaction-sheet";
import { BudgetProvider } from "@/store/budget-store";
import { UIProvider } from "@/store/ui-store";
import { AddFab } from "./add-fab";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { Toaster } from "./toaster";

/**
 * Coque de l'application : navigation (latérale ≥ lg, inférieure sinon),
 * zone de contenu, bouton d'ajout, feuille d'ajout et notifications.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BudgetProvider>
      <UIProvider>
        <Sidebar />
        <div className="lg:pl-72">
          <main className="mx-auto w-full max-w-6xl px-4 pb-44 sm:px-6 lg:px-10 lg:pb-16">{children}</main>
        </div>
        <BottomNav />
        <AddFab />
        <AddTransactionSheet />
        <Toaster />
      </UIProvider>
    </BudgetProvider>
  );
}
