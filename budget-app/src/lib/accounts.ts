/**
 * Comptes : soldes calculés et choix proposés dans les formulaires (fonctions pures).
 *
 * Solde d'un compte = solde de départ (saisi dans « Mes comptes »)
 *                   + revenus − dépenses − épargne versée depuis ce compte,
 * pour les opérations enregistrées sur ce compte jusqu'à la date donnée.
 * C'est un solde calculé à partir de ce qui est saisi dans Cocon, pas un relevé bancaire.
 */
import { isLiquidAccount } from "@/config/accounts";
import type { Account, AccountId, Transaction, TransactionKind } from "@/types/finance";
import { roundCents } from "./format";

/** Effet d'une opération sur le compte qui la porte. */
export function accountMovement(t: Pick<Transaction, "amount" | "kind">): number {
  return t.kind === "income" ? t.amount : -t.amount;
}

export function accountBalance(
  account: Pick<Account, "id" | "initialBalance">,
  transactions: Pick<Transaction, "accountId" | "amount" | "kind" | "date">[],
  until: string,
): number {
  const net = transactions.filter((t) => t.accountId === account.id && t.date <= until).reduce((acc, t) => acc + accountMovement(t), 0);
  return roundCents(account.initialBalance + net);
}

/** Identifiants des comptes d'épargne (Livret A…), exclus du « solde total ». */
export function savingsAccountIds(accounts: Account[]): Set<AccountId> {
  return new Set(accounts.filter((a) => !isLiquidAccount(a)).map((a) => a.id));
}

/**
 * Solde total hors épargne : tous les comptes courants, joints et espèces (actifs ou non :
 * un compte désactivé garde son historique et son solde).
 */
export function liquidBalance(accounts: Account[], transactions: Pick<Transaction, "accountId" | "amount" | "kind" | "date">[], until: string): number {
  return roundCents(accounts.filter(isLiquidAccount).reduce((acc, account) => acc + accountBalance(account, transactions, until), 0));
}

/**
 * Comptes proposés pour une opération : comptes actifs (y compris le Livret A pour un revenu ou une dépense).
 * L'épargne se verse depuis un compte hors épargne. Le compte actuel d'une opération modifiée reste proposé.
 */
export function accountChoices(accounts: Account[], kind: TransactionKind, keepId?: AccountId): Account[] {
  return accounts.filter((a) => a.id === keepId || (a.isActive && (kind !== "saving" || isLiquidAccount(a))));
}

/** Compte proposé par défaut : le compte courant actif, sinon le premier compte actif hors épargne. */
export function preferredAccountId(accounts: Account[], kind: TransactionKind = "expense"): AccountId {
  const choices = accountChoices(accounts, kind);
  return (choices.find((a) => a.type === "checking") ?? choices.find(isLiquidAccount) ?? choices[0])?.id ?? "";
}

/** On garde toujours au moins un compte actif hors épargne : sans lui, impossible d'enregistrer une opération. */
export function canDeactivateAccount(accounts: Account[], id: AccountId): boolean {
  const account = accounts.find((a) => a.id === id);
  if (!account || !account.isActive || !isLiquidAccount(account)) return true;
  return accounts.some((a) => a.id !== id && a.isActive && isLiquidAccount(a));
}

/** Nouvel ordre après déplacement d'un compte à une position donnée. */
export function moveInOrder(ids: AccountId[], id: AccountId, toIndex: number): AccountId[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const target = Math.max(0, Math.min(toIndex, ids.length - 1));
  const next = ids.filter((x) => x !== id);
  next.splice(target, 0, id);
  return next;
}

export const accountTypeLabel: Record<Account["type"], string> = {
  checking: "Compte courant",
  joint: "Compte joint",
  cash: "Espèces",
  savings: "Épargne",
  other: "Autre compte",
};
