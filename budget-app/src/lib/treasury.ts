/**
 * Trésorerie (fonctions pures) : l'argent réellement présent sur les comptes.
 *
 * Le chiffre principal de Cocon (« Tu peux encore dépenser ») part de cet argent réel :
 * ce qu'il y a aujourd'hui sur les comptes hors épargne, moins ce qui en partira encore d'ici la fin
 * du mois (dépenses datées, prélèvements réguliers, virements d'épargne). Un revenu pas encore arrivé
 * ne compte pas. Le reste du BUDGET du mois (revenus − dépenses − épargne prévue) est un autre chiffre,
 * affiché dans Budget.
 */
import { isLiquidAccount } from "@/config/accounts";
import type { Account, Transaction, UpcomingItem } from "@/types/finance";
import { liquidBalance, movementOn, netWorth } from "./accounts";
import { daysInMonth, dayOfMonth, monthKey } from "./dates";
import { roundCents } from "./format";

type Movement = Pick<Transaction, "accountId" | "transferAccountId" | "amount" | "kind" | "date">;
type UpcomingMovement = Pick<UpcomingItem, "accountId" | "transferAccountId" | "amount" | "kind" | "date">;

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

export interface Spendable {
  /** Argent sur les comptes hors épargne aujourd'hui. */
  onAccounts: number;
  /** Ce qui partira encore de ces comptes d'ici la fin du mois. */
  outgoing: number;
  /** Ce que tu peux encore dépenser : onAccounts − outgoing. */
  available: number;
  /** Jours restants dans le mois, aujourd'hui compris. */
  daysLeft: number;
  perDay: number;
}

/**
 * « Tu peux encore dépenser » : l'argent réellement sur les comptes hors épargne, moins les sorties
 * encore à venir ce mois-ci (dépenses, prélèvements, épargne versée vers un compte d'épargne).
 * Les revenus à venir sont ignorés : seul l'argent déjà là compte.
 */
export function getSpendable(accounts: Account[], transactions: Movement[], upcoming: UpcomingMovement[], today: string): Spendable {
  const liquid = accounts.filter(isLiquidAccount);
  const onAccounts = liquidBalance(accounts, transactions, today);
  const outgoing = roundCents(
    -upcoming
      .filter((u) => u.kind !== "income" && u.date > today && monthKey(u.date) === monthKey(today))
      .reduce((acc, u) => acc + liquid.reduce((sum, account) => sum + movementOn(u, account.id), 0), 0),
  );
  const available = roundCents(onAccounts - outgoing);
  const daysLeft = daysInMonth(today) - dayOfMonth(today) + 1;
  return { onAccounts, outgoing, available, daysLeft, perDay: available / daysLeft };
}

/** Le solde des comptes passerait sous zéro avant la fin du mois. */
export type TreasuryAlert = { kind: "overdraft"; lowest: number; date: string; beforeExpectedIncome: boolean };

export interface TreasuryInput {
  accounts: Account[];
  /** Toutes les opérations enregistrées (passées et futures) : le solde du jour ne compte que les passées. */
  transactions: Movement[];
  /** Opérations à venir d'ici la fin du mois (prévues et échéances récurrentes). */
  upcoming: UpcomingMovement[];
  today: string;
  /** Revenus attendus d'après le budget, pas encore saisis (salaire attendu…). */
  incomeExpected: number;
}

/**
 * Garde de trésorerie : le solde le plus bas d'ici la fin du mois (opérations datées, revenus compris,
 * dans l'ordre des dates) passerait sous zéro. Rien n'est signalé sans compte hors épargne.
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
  return null;
}
