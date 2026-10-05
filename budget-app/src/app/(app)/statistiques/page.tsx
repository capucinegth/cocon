import type { Metadata } from "next";
import { StatsScreen } from "@/features/stats/stats-screen";

export const metadata: Metadata = { title: "Statistiques" };

export default function StatsPage() {
  return <StatsScreen />;
}
