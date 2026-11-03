/**
 * Charges fixes par compte (fonctions pures) : ce qui part d'office de chaque compte dans le mois,
 * d'après les prélèvements réguliers (loyer, abonnements…) et les virements d'épargne automatiques.
 *
 * Le total du mois compte toutes les échéances du mois, y compris celles déjà passées : c'est ce qu'il faut
 * prévoir chaque mois. « Encore à prélever » ne compte que les échéances pas encore passées (mois en cours).
 */
import { isLiquidAccount } from "@/config/accounts";
import type { Account, AccountId, RecurringRule, Transaction, UpcomingItem } from "@/types/finance";
import { accountBalance, ruleAccountsActive } from "./accounts";
import { addDays, daysBetween, daysInMonth, monthKey } from "./dates";
import { roundCents } from "./format";

/** Échéances d'une règle dans un mois (AAAA-MM), passées comprises, d'après son rythme et son jour d'ancrage. */
export function occurrencesInMonth(rule: Pick<RecurringRule, "frequency" | "nextOccurrence" | "anchorDay">, month: string): string[] {
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth(first)).padStart(2, "0")}`;
  if (rule.frequency === "monthly") {
    const day = Math.min(rule.anchorDay ?? Number(rule.nextOccurrence.slice(8, 10)), daysInMonth(first));
    return [`${month}-${String(day).padStart(2, "0")}`];
  }
  // Hebdomadaire : même jour de la semaine que la prochaine échéance.
  const offset = ((daysBetween(first, rule.nextOccurrence) % 7) + 7) % 7;
  const dates: string[] = [];
  for (let date = addDays(first, offset); date <= last; date = addDays(date, 7)) dates.push(date);
  return dates;
}

export interface FixedCharge {
  rule: RecurringRule;
  /** Échéances dans le mois (une pour une charge mensuelle, 4 ou 5 pour une charge hebdomadaire). */
  dates: string[];
  total: number;
}

export interface AccountFixedCharges {
  account: Account;
  charges: FixedCharge[];
  /** Total qui part d'office de ce compte dans le mois. */
  monthly: number;
  /** Mois en cours seulement : échéances pas encore prélevées d'ici la fin du mois. */
  remaining: number;
  /** Solde du compte aujourd'hui. */
  balance: number;
  /** Solde une fois les charges fixes restantes du mois prélevées. */
  afterCharges: number;
}

interface FixedChargesInput {
  accounts: Account[];
  recurring: RecurringRule[];
  /** Opérations passées (le solde du jour ne compte que celles-ci). */
  transactions: Pick<Transaction, "accountId" | "transferAccountId" | "amount" | "kind" | "date">[];
  upcoming: Pick<UpcomingItem, "accountId" | "amount" | "date" | "recurrenceId">[];
  today: string;
}

/** Une charge fixe sort de son compte : dépense ou virement d'épargne, active et sur des comptes actifs. */
function isFixedOutflow(rule: RecurringRule, accountId: AccountId, accounts: Account[]): boolean {
  return rule.isActive && rule.kind !== "income" && rule.accountId === accountId && ruleAccountsActive(rule, accounts);
}

/** Comptes actifs hors épargne qui portent au moins une charge fixe, dans l'ordre d'affichage. */
export function getFixedChargesByAccount(input: FixedChargesInput, month: string): AccountFixedCharges[] {
  const current = month === monthKey(input.today);
  return input.accounts
    .filter((account) => account.isActive && isLiquidAccount(account))
    .map((account) => {
      const charges = input.recurring
        .filter((rule) => isFixedOutflow(rule, account.id, input.accounts))
        .map<FixedCharge>((rule) => {
          const dates = occurrencesInMonth(rule, month);
          return { rule, dates, total: roundCents(rule.amount * dates.length) };
        })
        .filter((charge) => charge.dates.length > 0)
        .sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.rule.label.localeCompare(b.rule.label));
      // Échéances à venir de ces charges : projetées, ou déjà créées à l'avance (datées dans le futur).
      const ruleIds = new Set(charges.map((c) => c.rule.id));
      const remaining = current
        ? roundCents(
            input.upcoming
              .filter((u) => u.recurrenceId !== undefined && ruleIds.has(u.recurrenceId) && u.accountId === account.id && monthKey(u.date) === month)
              .reduce((acc, u) => acc + u.amount, 0),
          )
        : 0;
      const balance = accountBalance(account, input.transactions, input.today);
      return {
        account,
        charges,
        monthly: roundCents(charges.reduce((acc, c) => acc + c.total, 0)),
        remaining,
        balance,
        afterCharges: roundCents(balance - remaining),
      };
    })
    .filter((entry) => entry.charges.length > 0);
}
