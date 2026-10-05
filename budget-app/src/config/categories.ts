import type { Category, CategoryGroup, CategoryId, Tone } from "@/types/finance";

/**
 * Catégories proposées par défaut. L'utilisateur peut en ajouter d'autres
 * (elles vivent ensuite dans le store, comme le feraient des lignes en base).
 */
export const defaultCategories: Category[] = [
  // Dépenses — dans l'ordre d'affichage du budget
  { id: "logement", label: "Logement", emoji: "🏠", group: "fixes", tone: "lilac" },
  { id: "courses", label: "Courses", emoji: "🧺", group: "variables", tone: "sage" },
  { id: "transport", label: "Transport", emoji: "🚆", group: "variables", tone: "lilac" },
  { id: "restaurants", label: "Restaurants", shortLabel: "Restos", emoji: "🍝", group: "variables", tone: "peach" },
  { id: "loisirs", label: "Loisirs", emoji: "🎟️", group: "variables", tone: "blush" },
  { id: "shopping", label: "Shopping", emoji: "🛍️", group: "variables", tone: "blush" },
  { id: "sante", label: "Santé", emoji: "🌿", group: "variables", tone: "sage" },
  { id: "abonnements", label: "Abonnements", shortLabel: "Abos", emoji: "📱", group: "fixes", tone: "lilac" },
  { id: "autres", label: "Autres", emoji: "📦", group: "variables", tone: "peach" },

  // Revenus
  { id: "salaire", label: "Salaire", emoji: "💼", group: "revenus", tone: "sage" },
  { id: "freelance", label: "Freelance", emoji: "✨", group: "revenus", tone: "blush" },
  { id: "autres-revenus", label: "Autres revenus", shortLabel: "Autres", emoji: "💶", group: "revenus", tone: "peach" },

  // Épargne
  { id: "epargne", label: "Épargne", emoji: "🌱", group: "epargne", tone: "sage" },
];

export const categoryGroups: Record<CategoryGroup, { label: string; description: string }> = {
  revenus: { label: "Revenus", description: "Ce qui entre ce mois-ci" },
  fixes: { label: "Charges fixes", description: "Loyer, factures, abonnements" },
  variables: { label: "Dépenses du quotidien", description: "Courses, sorties, imprévus" },
  epargne: { label: "Épargne", description: "Mis de côté pour tes objectifs" },
};

const fallbackCategory: Category = { id: "autres", label: "Autres", emoji: "📦", group: "variables", tone: "peach" };

export function findCategory(list: Category[], id: CategoryId): Category {
  return list.find((category) => category.id === id) ?? fallbackCategory;
}

export function isExpenseCategory(category: Category): boolean {
  return category.group === "fixes" || category.group === "variables";
}

/** Emojis proposés à la création d'une catégorie ou d'un objectif. */
export const emojiChoices = ["🏠", "🧺", "🚆", "🍝", "🎟️", "🛍️", "🌿", "📱", "📦", "🐾", "🎁", "📚", "💇", "🧸", "🚗", "✈️", "🌴", "💻", "🛡️", "🎓", "💍", "🏡"];

export const toneChoices: { tone: Tone; label: string }[] = [
  { tone: "blush", label: "Rose" },
  { tone: "lilac", label: "Lilas" },
  { tone: "sage", label: "Sauge" },
  { tone: "peach", label: "Pêche" },
];
