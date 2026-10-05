import type { Account, AccountId, AccountType } from "@/types/finance";

/** Emoji affiché selon le type de compte. */
export const accountTypeEmoji: Record<AccountType, string> = {
  checking: "🏦",
  joint: "🤝",
  cash: "💶",
  savings: "🌱",
  other: "💳",
};

/** Comptes de la démonstration (les vrais comptes viennent de la base). */
export const demoAccounts: Account[] = [
  { id: "courant", label: "Compte courant", emoji: "🏦", type: "checking", initialBalance: 390.3, isActive: true },
  { id: "joint", label: "Compte joint", emoji: "🤝", type: "joint", initialBalance: 0, isActive: true },
  { id: "especes", label: "Espèces", emoji: "💶", type: "cash", initialBalance: 0, isActive: true },
  { id: "livret", label: "Livret A", emoji: "🌱", type: "savings", initialBalance: 0, isActive: true },
];

const unknownAccount: Account = { id: "", label: "Compte", emoji: "💳", type: "other", initialBalance: 0, isActive: false };

export function findAccount(list: Account[], id: AccountId): Account {
  return list.find((account) => account.id === id) ?? unknownAccount;
}

/** Comptes proposés dans le formulaire d'ajout : actifs, hors épargne. */
export function quickAddAccounts(list: Account[]): Account[] {
  return list.filter((account) => account.isActive && account.type !== "savings");
}

/** Comptes pris en compte dans le « solde » (argent disponible, hors épargne). */
export function isLiquidAccount(account: Account): boolean {
  return account.type !== "savings";
}
