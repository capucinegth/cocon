import type { Metadata } from "next";
import { DeadlinesScreen } from "@/features/administratif/deadlines-screen";

export const metadata: Metadata = { title: "Échéances" };

export default function EcheancesPage() {
  return <DeadlinesScreen />;
}
