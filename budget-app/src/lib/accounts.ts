/**
 * Comptes : soldes calculés, patrimoine et choix proposés dans les formulaires (fonctions pures).
 *
 * Une épargne est un TRANSFERT entre deux comptes Cocon : elle sort du compte source
 * (hors épargne) et entre sur le compte d'épargne de destination (Livret A…).
 *
 * Solde d'un compte = solde de départ (saisi dans « Mes comptes »)
 *                   + revenus − dépenses − épargne versée depuis ce compte
 *                   + épargne reçue sur ce compte,
 * pour les opérations enregistrées jusqu'à la date donnée.
 * Un transfert ne change donc pas le patrimoine total. Une ancienne épargne sans compte de
 * destination (antérieure aux transferts) sort de son compte source sans arriver nulle part.
 * C'est un solde calculé à partir de ce qui est saisi dans Cocon, pas un relevé bancaire.
 */
import { isLiquidAccount } from "@/config/accounts";
import type { Account, AccountId, RecurringRule, Transaction, TransactionKind } from "@/types/finance";
import { roundCents } from "./format";

type Movement = Pick<Transaction, "accountId" | "transferAccountId" | "amount" | "kind" | "date">;

/** Effet d'une opération sur son compte source (celui qui la porte). */
export function accountMovement(t: Pick<Transaction, "amount" | "kind">): number {
  return t.kind === "income" ? t.amount : -t.amount;
}

/** Effet d'une opération sur un compte donné : source (−/+) et, pour un transfert, destination (+). */
export function movementOn(t: Omit<Movement, "date">, accountId: AccountId): number {
  let value = 0;
  if (t.accountId === accountId) value += accountMovement(t);
  if (t.kind === "saving" && t.transferAccountId === accountId) value += t.amount;
  return value;
}

export function accountBalance(account: Pick<Account, "id" | "initialBalance">, transactions: Movement[], until: string): number {
  const net = transactions.filter((t) => t.date <= until).reduce((acc, t) => acc + movementOn(t, account.id), 0);
  return roundCents(account.initialBalance + net);
}

/** Identifiants des comptes d'épargne (Livret A…), exclus du « solde total hors épargne ». */
export function savingsAccountIds(accounts: Account[]): Set<AccountId> {
  return new Set(accounts.filter((a) => !isLiquidAccount(a)).map((a) => a.id));
}

/**
 * Solde total hors épargne : tous les comptes courants, joints et espèces (actifs ou non :
 * un compte désactivé garde son historique et son solde).
 */
export function liquidBalance(accounts: Account[], transactions: Movement[], until: string): number {
  return roundCents(accounts.filter(isLiquidAccount).reduce((acc, account) => acc + accountBalance(account, transactions, until), 0));
}

/** Patrimoine total : tous les comptes, épargne comprise. Un transfert ne le modifie pas. */
export function netWorth(accounts: Account[], transactions: Movement[], until: string): number {
  return roundCents(accounts.reduce((acc, account) => acc + accountBalance(account, transactions, until), 0));
}

/**
 * Comptes proposés comme compte de l'opération (ou compte SOURCE d'une épargne) : comptes actifs
 * hors épargne. Un compte d'épargne ne se mouvemente que par transfert (destination d'une épargne).
 * Le compte actuel d'une opération modifiée reste proposé.
 */
export function accountChoices(accounts: Account[], _kind: TransactionKind, keepId?: AccountId): Account[] {
  return accounts.filter((a) => a.id === keepId || (a.isActive && isLiquidAccount(a)));
}

/** Comptes de DESTINATION d'une épargne : comptes d'épargne actifs (+ la destination actuelle en modification). */
export function destinationChoices(accounts: Account[], keepId?: AccountId): Account[] {
  return accounts.filter((a) => a.id === keepId || (a.isActive && !isLiquidAccount(a)));
}

/** Compte proposé par défaut : le compte courant actif, sinon le premier compte actif hors épargne. */
export function preferredAccountId(accounts: Account[], kind: TransactionKind = "expense"): AccountId {
  const choices = accountChoices(accounts, kind);
  return (choices.find((a) => a.type === "checking") ?? choices[0])?.id ?? "";
}

/** Destination proposée par défaut pour une épargne : le premier compte d'épargne actif. */
export function preferredDestinationId(accounts: Account[]): AccountId | undefined {
  return destinationChoices(accounts)[0]?.id;
}

/** On garde toujours au moins un compte actif hors épargne : sans lui, impossible d'enregistrer une opération. */
export function canDeactivateAccount(accounts: Account[], id: AccountId): boolean {
  const account = accounts.find((a) => a.id === id);
  if (!account || !account.isActive || !isLiquidAccount(account)) return true;
  return accounts.some((a) => a.id !== id && a.isActive && isLiquidAccount(a));
}

/** Récurrences actives qui utilisent ce compte (source ou destination) : à mettre en pause s'il est désactivé. */
export function activeRulesUsingAccount(rules: RecurringRule[], accountId: AccountId): RecurringRule[] {
  return rules.filter((r) => r.isActive && (r.accountId === accountId || r.transferAccountId === accountId));
}

/** Une règle ne peut être active que si ses comptes sont actifs (comme la génération en base). */
export function ruleAccountsActive(rule: Pick<RecurringRule, "accountId" | "transferAccountId">, accounts: Account[]): boolean {
  const active = (id: AccountId) => accounts.find((a) => a.id === id)?.isActive ?? true;
  return active(rule.accountId) && (rule.transferAccountId === undefined || active(rule.transferAccountId));
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
