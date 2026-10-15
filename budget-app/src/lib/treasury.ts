/**
 * Trésorerie (fonctions pures) : l'argent réellement présent sur les comptes, à côté du budget.
 *
 * Le chiffre principal de Cocon reste la réponse BUDGÉTAIRE du mois (« Tu peux encore dépenser »).
 * Cette garde ne le remplace jamais : elle signale seulement quand l'argent des comptes hors épargne,
 * après les opérations déjà connues du mois, ne suffirait pas à le couvrir.
 */
import { isLiquidAccount } from "@/config/accounts";
import type { Account, Transaction, UpcomingItem } from "@/types/finance";
import { liquidBalance, movementOn, netWorth } from "./accounts";
import { roundCents } from "./format";

type Movement = Pick<Transaction, "accountId" | "transferAccountId" | "amount" | "kind" | "date">;

export interface MoneyOverview {
  /** Sur les comptes courants, joints et espèces (hors épargne). */
  onAccounts: number;
  /** Sur les comptes d'épargne (Livret A…). */
  savings: number;
  /** Tout l'argent : comptes + épargne. */
  total: number;
}

export function getMoneyOverview(accounts: Account[], transactions: Movement[], today: string): MoneyOverview {
  const onAccounts = liquidBalance(accounts, transactions, today);
  const total = netWorth(accounts, transactions, today);
  return { onAccounts, savings: roundCents(total - onAccounts), total };
}

export type TreasuryAlert =
  /** Le solde des comptes passerait sous zéro avant la fin du mois. */
  | { kind: "overdraft"; lowest: number; date: string; beforeExpectedIncome: boolean }
  /** En fin de mois, les comptes ne couvriraient pas ce que le budget laisse à dépenser. */
  | { kind: "short"; endBalance: number; remaining: number };

export interface TreasuryInput {
  accounts: Account[];
  /** Toutes les opérations enregistrées (passées et futures) : le solde du jour ne compte que les passées. */
  transactions: Movement[];
  /** Opérations à venir d'ici la fin du mois (prévues et échéances récurrentes). */
  upcoming: Pick<UpcomingItem, "accountId" | "transferAccountId" | "amount" | "kind" | "date">[];
  today: string;
  /** Ce que le budget laisse à dépenser ce mois-ci. */
  remaining: number;
  /** Revenus attendus d'après le budget, pas encore saisis (salaire attendu…). */
  incomeExpected: number;
}

/**
 * Garde de trésorerie (option A). Rien n'est signalé sans compte hors épargne, ni quand les comptes suffisent.
 * - « overdraft » : le solde le plus bas d'ici la fin du mois (opérations datées) passerait sous zéro ;
 * - « short » : en fin de mois (revenus attendus compris), il resterait moins que le disponible du budget.
 */
export function getTreasuryAlert(input: TreasuryInput): TreasuryAlert | null {
  const liquid = input.accounts.filter(isLiquidAccount);
  if (liquid.length === 0) return null;
  const onLiquid = (t: Omit<Movement, "date">) => liquid.reduce((acc, account) => acc + movementOn(t, account.id), 0);

  let balance = liquidBalance(input.accounts, input.transactions, input.today);
  let lowest = { value: balance, date: input.today };
  for (const item of [...input.upcoming].filter((u) => u.date > input.today).sort((a, b) => a.date.localeCompare(b.date))) {
    balance = roundCents(balance + onLiquid(item));
    if (balance < lowest.value) lowest = { value: balance, date: item.date };
  }

  if (lowest.value < 0) {
    return { kind: "overdraft", lowest: lowest.value, date: lowest.date, beforeExpectedIncome: input.incomeExpected > 0 };
  }
  const endBalance = roundCents(balance + Math.max(input.incomeExpected, 0));
  if (input.remaining > 0 && endBalance < input.remaining) {
    return { kind: "short", endBalance, remaining: input.remaining };
  }
  return null;
}
