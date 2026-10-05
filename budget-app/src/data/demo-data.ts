import type {
  AccountId,
  BudgetPlan,
  CategoryId,
  MonthHistoryPoint,
  SavingsGoal,
  Transaction,
  TransactionKind,
  UpcomingExpense,
} from "@/types/finance";

/**
 * Données fictives — on est le dimanche 13 septembre 2026.
 *
 * Septembre, tout est cohérent entre les écrans :
 *   revenus 2 150 € − charges fixes 840 € − dépenses du quotidien 366,80 € − épargne 300 €
 *   = 643,20 € disponibles  →  ÷ 18 jours restants ≈ 35,73 € / jour
 *
 *   charges fixes   = 100,01 € déjà payés + 739,99 € à venir (loyer, électricité, Netflix)
 *   quotidien       = 286,80 € déjà dépensés + 80 € de courses prévues
 *   budget quotidien prévu = 1 010 € (courses 300, restos 200, transport 120, loisirs 100,
 *                             shopping 150, santé 60, autres 80)
 *
 * Août est complet (dépenses 1 704 €, épargne 350 €) : il sert à la navigation entre
 * les mois et à la comparaison « même date, mois précédent » (−8 % au quotidien).
 */

type Extra = Partial<Pick<Transaction, "note" | "recurrence" | "goalId" | "accountId">>;

function tx(
  id: string,
  date: string,
  label: string,
  amount: number,
  kind: TransactionKind,
  categoryId: CategoryId,
  extra: Extra = {},
): Transaction {
  const accountId: AccountId = extra.accountId ?? "courant";
  return { id, date, label, amount, kind, categoryId, ...extra, accountId };
}

const monthly = { recurrence: "monthly" } as const;

const august: Transaction[] = [
  tx("a01", "2026-08-01", "Monoprix", 41.3, "expense", "courses"),
  tx("a02", "2026-08-03", "Café Pinson", 16.4, "expense", "restaurants"),
  tx("a03", "2026-08-04", "Box internet", 32.99, "expense", "abonnements", monthly),
  tx("a04", "2026-08-05", "Picard", 38.6, "expense", "courses"),
  tx("a05", "2026-08-06", "RATP", 17.4, "expense", "transport", { note: "Carnet de tickets" }),
  tx("a06", "2026-08-07", "Big Mamma", 42, "expense", "restaurants", { accountId: "joint" }),
  tx("a07", "2026-08-08", "Forfait mobile", 19.99, "expense", "abonnements", monthly),
  tx("a08", "2026-08-08", "iCloud+", 2.99, "expense", "abonnements", monthly),
  tx("a09", "2026-08-08", "Uniqlo", 29.9, "expense", "shopping"),
  tx("a10", "2026-08-09", "Marché d'Aligre", 22.4, "expense", "courses", { accountId: "especes" }),
  tx("a11", "2026-08-10", "Salle de sport", 32.92, "expense", "abonnements", monthly),
  tx("a12", "2026-08-10", "Uber", 23.8, "expense", "transport"),
  tx("a13", "2026-08-11", "UGC Ciné", 12, "expense", "loisirs"),
  tx("a14", "2026-08-11", "Pharmacie", 7.94, "expense", "sante"),
  tx("a15", "2026-08-12", "Salaire", 2150, "income", "salaire", monthly),
  tx("a16", "2026-08-12", "Virement épargne", 350, "saving", "epargne", { ...monthly, note: "Réparti sur 3 objectifs" }),
  tx("a17", "2026-08-12", "Carrefour", 60, "expense", "courses"),
  tx("a18", "2026-08-13", "Spotify", 11.12, "expense", "abonnements", monthly),
  tx("a19", "2026-08-15", "Loyer", 650, "expense", "logement", monthly),
  tx("a20", "2026-08-16", "Monoprix", 48.75, "expense", "courses"),
  tx("a21", "2026-08-18", "Électricité", 68, "expense", "logement", monthly),
  tx("a22", "2026-08-19", "Le Petit Bistrot", 38.6, "expense", "restaurants"),
  tx("a23", "2026-08-20", "Netflix", 17.99, "expense", "abonnements", monthly),
  tx("a24", "2026-08-21", "SNCF", 64, "expense", "transport", { note: "Paris → Nantes" }),
  tx("a25", "2026-08-22", "Carrefour", 71.35, "expense", "courses"),
  tx("a26", "2026-08-23", "Fnac", 34.99, "expense", "loisirs"),
  tx("a27", "2026-08-24", "Sézane", 85, "expense", "shopping"),
  tx("a28", "2026-08-26", "Sushi Shop", 34.5, "expense", "restaurants", { accountId: "joint" }),
  tx("a29", "2026-08-27", "Biocoop", 52.4, "expense", "courses"),
  tx("a30", "2026-08-28", "La Cigale", 32, "expense", "loisirs", { note: "Concert" }),
  tx("a31", "2026-08-29", "Sephora", 27.1, "expense", "shopping"),
  tx("a32", "2026-08-30", "Pressing", 18.9, "expense", "autres"),
  tx("a33", "2026-08-31", "Carrefour City", 48.67, "expense", "courses"),
];

const september: Transaction[] = [
  tx("s01", "2026-09-02", "Monoprix", 32.15, "expense", "courses"),
  tx("s02", "2026-09-04", "Box internet", 32.99, "expense", "abonnements", monthly),
  tx("s03", "2026-09-05", "Café Pinson", 18.5, "expense", "restaurants"),
  tx("s04", "2026-09-06", "Biocoop", 45.25, "expense", "courses"),
  tx("s05", "2026-09-06", "UGC Ciné", 13.5, "expense", "loisirs"),
  tx("s06", "2026-09-07", "SNCF", 38, "expense", "transport", { note: "Paris → Lyon" }),
  tx("s07", "2026-09-08", "Forfait mobile", 19.99, "expense", "abonnements", monthly),
  tx("s08", "2026-09-08", "iCloud+", 2.99, "expense", "abonnements", monthly),
  tx("s09", "2026-09-09", "Marché d'Aligre", 18.4, "expense", "courses", { accountId: "especes" }),
  tx("s10", "2026-09-09", "Pharmacie", 8.4, "expense", "sante"),
  tx("s11", "2026-09-10", "Salle de sport", 32.92, "expense", "abonnements", monthly),
  tx("s12", "2026-09-10", "Zara", 34.9, "expense", "shopping"),
  tx("s13", "2026-09-11", "Trattoria Mia", 23.5, "expense", "restaurants", { accountId: "joint" }),
  tx("s14", "2026-09-12", "Salaire", 2150, "income", "salaire", monthly),
  tx("s15", "2026-09-12", "Virement épargne", 300, "saving", "epargne", { ...monthly, note: "Réparti sur 3 objectifs" }),
  tx("s16", "2026-09-13", "Carrefour", 54.2, "expense", "courses"),
  tx("s17", "2026-09-13", "Spotify", 11.12, "expense", "abonnements", monthly),
];

export const demoTransactions: Transaction[] = [...august, ...september];

export const demoUpcoming: UpcomingExpense[] = [
  { id: "u1", label: "Loyer", amount: 650, categoryId: "logement", accountId: "courant", date: "2026-09-15" },
  { id: "u2", label: "Électricité", amount: 72, categoryId: "logement", accountId: "courant", date: "2026-09-18" },
  { id: "u3", label: "Courses prévues", amount: 80, categoryId: "courses", accountId: "courant", date: "2026-09-19" },
  { id: "u4", label: "Netflix", amount: 17.99, categoryId: "abonnements", accountId: "courant", date: "2026-09-20" },
];

export const demoBudgetPlan: BudgetPlan = {
  month: "2026-09",
  planned: {
    salaire: 2150,
    logement: 722,
    abonnements: 118,
    courses: 300,
    restaurants: 200,
    transport: 120,
    loisirs: 100,
    shopping: 150,
    sante: 60,
    autres: 80,
    epargne: 300,
  },
};

/** Montants à jour au 13 septembre (versements de septembre inclus). */
export const demoGoals: SavingsGoal[] = [
  { id: "g1", label: "Vacances", emoji: "🌴", tone: "lilac", saved: 1250, target: 2000, monthlyContribution: 100, deadline: "2027-06" },
  { id: "g2", label: "MacBook", emoji: "💻", tone: "blush", saved: 850, target: 1800, monthlyContribution: 100, deadline: "2027-08" },
  { id: "g3", label: "Fonds de sécurité", emoji: "🛡️", tone: "sage", saved: 2400, target: 5000, monthlyContribution: 100 },
];

/**
 * Historique résumé. Pour les mois qui ont des transactions détaillées (août, septembre),
 * les dépenses sont recalculées à partir des transactions.
 */
export const demoHistory: MonthHistoryPoint[] = [
  { month: "2026-04", expenses: 1742, savingsTotal: 3050 },
  { month: "2026-05", expenses: 1690, savingsTotal: 3330 },
  { month: "2026-06", expenses: 1735, savingsTotal: 3600 },
  { month: "2026-07", expenses: 1880, savingsTotal: 3850 },
  { month: "2026-08", expenses: 0, savingsTotal: 4200 },
  { month: "2026-09", expenses: 0, savingsTotal: 4500 },
];

/** Solde du compte courant au 1er de chaque mois (sert à l'évolution du solde). */
export const demoOpeningBalances: Record<string, number> = {
  "2026-08": 390.3,
  "2026-09": 486.3,
};
