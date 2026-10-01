import type { Account, AccountId } from "@/types/finance";

export const accounts: Record<AccountId, Account> = {
  courant: { id: "courant", label: "Compte courant", emoji: "🏦" },
  joint: { id: "joint", label: "Compte joint", emoji: "🤝" },
  especes: { id: "especes", label: "Espèces", emoji: "💶" },
  livret: { id: "livret", label: "Livret A", emoji: "🌱" },
};

/** Comptes proposés dans le formulaire d'ajout rapide. */
export const quickAddAccountIds: AccountId[] = ["courant", "joint", "especes"];

export function getAccount(id: AccountId): Account {
  return accounts[id];
}
