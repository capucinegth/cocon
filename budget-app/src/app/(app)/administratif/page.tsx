import type { Metadata } from "next";
import { AdminHome } from "@/features/administratif/admin-home";

export const metadata: Metadata = { title: "Mes papiers" };

export default function AdministratifPage() {
  return <AdminHome />;
}
