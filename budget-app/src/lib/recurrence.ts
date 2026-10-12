/**
 * Opérations récurrentes : même règle de calcul que la fonction SQL
 * `public.next_occurrence_date` (testées l'une contre l'autre).
 */
import type { RecurringRule, Transaction, UpcomingItem } from "@/types/finance";
import { addDays, daysInMonth } from "./dates";

/** Sécurité : jamais plus d'occurrences générées d'un coup (comme côté base). */
const MAX_OCCURRENCES = 500;

/**
 * Date suivante. Mensuel : même jour du mois, plafonné au dernier jour ;
 * le jour d'ancrage garde « le 31 » d'un mois sur l'autre (31 janv. → 28 févr. → 31 mars).
 */
export function nextOccurrenceDate(date: string, frequency: RecurringRule["frequency"], anchorDay?: number): string {
  if (frequency === "weekly") return addDays(date, 7);
  const [year, month, day] = date.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const targetDay = Math.min(anchorDay ?? day, daysInMonth(monthStart));
  return `${monthStart.slice(0, 8)}${String(targetDay).padStart(2, "0")}`;
}

/**
 * Première échéance de la règle à partir de `from` (incluse), en suivant son rythme
 * (même jour d'ancrage). Sert à reprendre une règle sans rattraper les dates passées.
 */
export function firstOccurrenceFrom(rule: Pick<RecurringRule, "nextOccurrence" | "frequency" | "anchorDay">, from: string): string {
  let date = rule.nextOccurrence;
  // Garde-fou : une règle hebdomadaire en pause depuis des décennies reste bornée.
  for (let guard = 0; date < from && guard < 10_000; guard += 1) {
    date = nextOccurrenceDate(date, rule.frequency, rule.anchorDay);
  }
  return date;
}

/** Occurrences d'une règle entre `nextOccurrence` et `until` (inclus). */
export function occurrencesUntil(rule: RecurringRule, until: string): string[] {
  const dates: string[] = [];
  let date = rule.nextOccurrence;
  while (date <= until && dates.length < MAX_OCCURRENCES) {
    dates.push(date);
    date = nextOccurrenceDate(date, rule.frequency, rule.anchorDay);
  }
  return dates;
}

/**
 * Prochaines échéances (après `today`, jusqu'à `until`) des règles actives,
 * sauf celles déjà présentes comme opérations.
 */
export function projectRecurring(
  rules: RecurringRule[],
  transactions: Pick<Transaction, "recurrenceId" | "date">[],
  today: string,
  until: string,
): UpcomingItem[] {
  const existing = new Set(transactions.filter((t) => t.recurrenceId).map((t) => `${t.recurrenceId}|${t.date}`));
  return rules
    .filter((rule) => rule.isActive)
    .flatMap((rule) =>
      occurrencesUntil(rule, until)
        .filter((date) => date > today && !existing.has(`${rule.id}|${date}`))
        .map<UpcomingItem>((date) => ({
          id: `${rule.id}:${date}`,
          label: rule.label,
          amount: rule.amount,
          kind: rule.kind,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          goalId: rule.goalId,
          date,
          origin: "recurring",
          recurrenceId: rule.id,
        })),
    );
}

/**
 * Génère les opérations dues (jusqu'à `until`) et avance les règles — équivalent local
 * de `materialize_recurring_transactions`. Idempotent : une date déjà générée ne l'est jamais deux fois.
 */
export function materializeRecurring(
  rules: RecurringRule[],
  transactions: Transaction[],
  until: string,
  makeId: () => string,
): { transactions: Transaction[]; rules: RecurringRule[]; created: Transaction[] } {
  const existing = new Set(transactions.filter((t) => t.recurrenceId).map((t) => `${t.recurrenceId}|${t.date}`));
  const created: Transaction[] = [];
  const nextRules = rules.map((rule) => {
    if (!rule.isActive || rule.nextOccurrence > until) return rule;
    const dates = occurrencesUntil(rule, until);
    dates
      .filter((date) => !existing.has(`${rule.id}|${date}`))
      .forEach((date) =>
        created.push({
          id: makeId(),
          label: rule.label,
          amount: rule.amount,
          kind: rule.kind,
          categoryId: rule.categoryId,
          accountId: rule.accountId,
          goalId: rule.goalId,
          date,
          recurrence: rule.frequency,
          recurrenceId: rule.id,
        }),
      );
    const last = dates.at(-1);
    return last ? { ...rule, nextOccurrence: nextOccurrenceDate(last, rule.frequency, rule.anchorDay) } : rule;
  });
  return { transactions: [...created, ...transactions], rules: nextRules, created };
}
