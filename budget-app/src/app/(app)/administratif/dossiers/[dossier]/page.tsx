import type { Metadata } from "next";
import { FolderScreen } from "@/features/administratif/folder-screen";

export const metadata: Metadata = { title: "Dossier" };

export default async function DossierPage({ params }: { params: Promise<{ dossier: string }> }) {
  const { dossier } = await params;
  return <FolderScreen folderId={dossier} />;
}
