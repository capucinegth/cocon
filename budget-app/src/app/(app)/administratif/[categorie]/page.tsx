import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryScreen } from "@/features/administratif/category-screen";
import { categoryInfo, documentCategories, isDocumentCategory } from "@/lib/admin/catalog";

export function generateStaticParams() {
  return documentCategories.map((c) => ({ categorie: c.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ categorie: string }> }): Promise<Metadata> {
  const { categorie } = await params;
  return { title: isDocumentCategory(categorie) ? categoryInfo(categorie).label : "Mes papiers" };
}

export default async function CategoriePage({ params }: { params: Promise<{ categorie: string }> }) {
  const { categorie } = await params;
  if (!isDocumentCategory(categorie)) notFound();
  return <CategoryScreen category={categorie} />;
}
