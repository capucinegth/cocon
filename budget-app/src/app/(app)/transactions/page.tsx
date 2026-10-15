import type { Metadata } from "next";
import { TransactionsScreen } from "@/features/transactions/transactions-screen";

export const metadata: Metadata = { title: "Dépenses et revenus" };

export default function TransactionsPage() {
  return <TransactionsScreen />;
}
