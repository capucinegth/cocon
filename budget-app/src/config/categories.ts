import type { Category, CategoryGroup, CategoryId } from "@/types/finance";

/**
 * Catalogue des catégories. Ajouter, renommer ou recolorer une catégorie
 * se fait uniquement ici.
 */
export const categories: Record<CategoryId, Category> = {
  salaire: { id: "salaire", label: "Salaire", emoji: "💼", group: "revenus", tone: "blush" },
  freelance: { id: "freelance", label: "Freelance", emoji: "✨", group: "revenus", tone: "blush" },

  logement: { id: "logement", label: "Logement", emoji: "🏠", group: "fixes", tone: "lilac" },
  energie: { id: "energie", label: "Énergie", emoji: "💡", group: "fixes", tone: "peach" },
  assurances: { id: "assurances", label: "Assurances", emoji: "☂️", group: "fixes", tone: "sage" },
  abonnements: { id: "abonnements", label: "Abonnements", shortLabel: "Abos", emoji: "📱", group: "fixes", tone: "lilac" },

  courses: { id: "courses", label: "Courses", emoji: "🧺", group: "variables", tone: "sage" },
  restaurants: { id: "restaurants", label: "Restaurants", shortLabel: "Restos", emoji: "🍝", group: "variables", tone: "peach" },
  shopping: { id: "shopping", label: "Shopping", emoji: "🛍️", group: "variables", tone: "blush" },
  transport: { id: "transport", label: "Transport", emoji: "🚆", group: "variables", tone: "lilac" },
  loisirs: { id: "loisirs", label: "Loisirs", emoji: "🎟️", group: "variables", tone: "blush" },

  epargne: { id: "epargne", label: "Épargne", emoji: "🌱", group: "epargne", tone: "sage" },
};

export const categoryGroups: Record<CategoryGroup, { label: string; description: string }> = {
  revenus: { label: "Revenus", description: "Ce qui entre ce mois-ci" },
  fixes: { label: "Charges fixes", description: "Loyer, factures, abonnements" },
  variables: { label: "Dépenses variables", description: "Le quotidien" },
  epargne: { label: "Épargne", description: "Mis de côté pour tes objectifs" },
};

export function getCategory(id: CategoryId): Category {
  return categories[id];
}

export function getCategoriesByGroup(group: CategoryGroup): Category[] {
  return Object.values(categories).filter((category) => category.group === group);
}

/** Catégories proposées dans le formulaire d'ajout. */
export const expenseCategoryIds: CategoryId[] = [
  "courses",
  "restaurants",
  "shopping",
  "transport",
  "loisirs",
  "abonnements",
  "logement",
  "energie",
];

export const incomeCategoryIds: CategoryId[] = ["salaire", "freelance"];
