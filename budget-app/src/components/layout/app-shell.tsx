import type { ReactNode } from "react";
import { AddCategorySheet } from "@/features/budget/add-category-sheet";
import { AddGoalSheet } from "@/features/goals/add-goal-sheet";
import { AddTransactionSheet } from "@/features/transactions/add-transaction-sheet";
import { TransactionDetailSheet } from "@/features/transactions/transaction-detail-sheet";
import { BudgetProvider } from "@/store/budget-store";
import { UIProvider } from "@/store/ui-store";
import { AddFab } from "./add-fab";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { Toaster } from "./toaster";

/**
 * Coque de l'application : navigation (latérale ≥ lg, inférieure sinon),
 * zone de contenu centrée, bouton d'ajout, feuilles modales et notifications.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BudgetProvider>
      <UIProvider>
        <Sidebar />
        <div className="lg:pl-64">
          <main className="mx-auto w-full max-w-[68rem] px-4 pb-44 sm:px-6 lg:px-10 lg:pb-16">{children}</main>
        </div>
        <BottomNav />
        <AddFab />
        <AddTransactionSheet />
        <TransactionDetailSheet />
        <AddCategorySheet />
        <AddGoalSheet />
        <Toaster />
      </UIProvider>
    </BudgetProvider>
  );
}
