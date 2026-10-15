import type { ReactNode } from "react";
import { AddCategorySheet } from "@/features/budget/add-category-sheet";
import { CategoryEditSheet } from "@/features/budget/category-edit-sheet";
import { FixedChargeSheet } from "@/features/budget/fixed-charge-sheet";
import { RecurringSheet } from "@/features/budget/recurring-sheet";
import { TargetsSheet } from "@/features/budget/targets-sheet";
import { AddGoalSheet } from "@/features/goals/add-goal-sheet";
import { AccountSheet } from "@/features/settings/account-sheet";
import { PasswordSheet } from "@/features/settings/password-sheet";
import { ProfileSheet } from "@/features/settings/profile-sheet";
import { AddTransactionSheet } from "@/features/transactions/add-transaction-sheet";
import { TransactionDetailSheet } from "@/features/transactions/transaction-detail-sheet";
import { BudgetProvider } from "@/store/budget-store";
import { SessionProvider } from "@/store/session-store";
import { UIProvider } from "@/store/ui-store";
import { AddFab } from "./add-fab";
import { BottomNav } from "./bottom-nav";
import { DataGate } from "./data-gate";
import { PasswordRecoveryBridge } from "./password-recovery-bridge";
import { PreferencesBridge } from "./preferences-bridge";
import { Sidebar } from "./sidebar";
import { Toaster } from "./toaster";

/**
 * Coque de l'application : session, données, navigation (latérale ≥ lg, inférieure sinon),
 * zone de contenu centrée, bouton d'ajout, feuilles modales et notifications.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <BudgetProvider>
        <UIProvider>
          <PreferencesBridge />
          <PasswordRecoveryBridge />
          <Sidebar />
          <div className="lg:pl-64">
            <main className="mx-auto w-full max-w-[68rem] px-4 pb-44 sm:px-6 lg:px-10 lg:pb-16">
              <DataGate>{children}</DataGate>
            </main>
          </div>
          <BottomNav />
          <AddFab />
          <AddTransactionSheet />
          <TransactionDetailSheet />
          <AddCategorySheet />
          <CategoryEditSheet />
          <TargetsSheet />
          <RecurringSheet />
          <FixedChargeSheet />
          <AddGoalSheet />
          <ProfileSheet />
          <AccountSheet />
          <PasswordSheet />
          <Toaster />
        </UIProvider>
      </BudgetProvider>
    </SessionProvider>
  );
}
