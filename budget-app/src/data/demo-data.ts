import type {
  BudgetPlan,
  MonthHistoryPoint,
  PreviousMonthToDate,
  SavingsGoal,
  Transaction,
  UpcomingExpense,
} from "@/types/finance";

/**
 * Données fictives — septembre 2026, au 13 du mois.
 *
 * Les chiffres sont cohérents entre eux :
 *   revenus 2 100 € − dépenses engagées 1 156,80 € − épargne 300 € = 643,20 €
 *   643,20 € ÷ 18 jours restants ≈ 35,73 € / jour
 */

export const demoTransactions: Transaction[] = [
  // Revenus
  { id: "t01", label: "Salaire", amount: 1950, kind: "income", categoryId: "salaire", accountId: "courant", date: "2026-09-01" },
  { id: "t02", label: "Mission freelance", amount: 150, kind: "income", categoryId: "freelance", accountId: "courant", date: "2026-09-10", note: "Identité visuelle — atelier" },

  // Épargne
  { id: "t03", label: "Virement Livret A", amount: 300, kind: "saving", categoryId: "epargne", accountId: "courant", date: "2026-09-02", note: "Réparti sur 3 objectifs" },

  // Dépenses
  { id: "t04", label: "Loyer", amount: 650, kind: "expense", categoryId: "logement", accountId: "courant", date: "2026-09-01" },
  { id: "t05", label: "Monoprix", amount: 32.15, kind: "expense", categoryId: "courses", accountId: "courant", date: "2026-09-02" },
  { id: "t06", label: "RATP", amount: 17.4, kind: "expense", categoryId: "transport", accountId: "courant", date: "2026-09-02", note: "Carnet de tickets" },
  { id: "t07", label: "Netflix", amount: 13.49, kind: "expense", categoryId: "abonnements", accountId: "courant", date: "2026-09-03" },
  { id: "t08", label: "Big Mamma", amount: 42, kind: "expense", categoryId: "restaurants", accountId: "joint", date: "2026-09-04" },
  { id: "t09", label: "Spotify", amount: 10.99, kind: "expense", categoryId: "abonnements", accountId: "courant", date: "2026-09-05" },
  { id: "t10", label: "Café Pinson", amount: 18.5, kind: "expense", categoryId: "restaurants", accountId: "courant", date: "2026-09-05" },
  { id: "t11", label: "Sephora", amount: 27.1, kind: "expense", categoryId: "shopping", accountId: "courant", date: "2026-09-06" },
  { id: "t12", label: "SNCF", amount: 38, kind: "expense", categoryId: "transport", accountId: "courant", date: "2026-09-07", note: "Paris → Lyon" },
  { id: "t13", label: "Sushi Shop", amount: 34.5, kind: "expense", categoryId: "restaurants", accountId: "joint", date: "2026-09-08" },
  { id: "t14", label: "iCloud+", amount: 2.99, kind: "expense", categoryId: "abonnements", accountId: "courant", date: "2026-09-08" },
  { id: "t15", label: "Marché d'Aligre", amount: 18.4, kind: "expense", categoryId: "courses", accountId: "especes", date: "2026-09-09" },
  { id: "t16", label: "Pret A Manger", amount: 12.9, kind: "expense", categoryId: "restaurants", accountId: "courant", date: "2026-09-10" },
  { id: "t17", label: "Le Petit Bistrot", amount: 32.6, kind: "expense", categoryId: "restaurants", accountId: "courant", date: "2026-09-11" },
  { id: "t18", label: "Uber", amount: 22.6, kind: "expense", categoryId: "transport", accountId: "courant", date: "2026-09-11" },
  { id: "t19", label: "Zara", amount: 64.9, kind: "expense", categoryId: "shopping", accountId: "courant", date: "2026-09-12" },
  { id: "t20", label: "Carrefour City", amount: 27.89, kind: "expense", categoryId: "courses", accountId: "courant", date: "2026-09-12" },
  { id: "t21", label: "Trattoria Mia", amount: 23.5, kind: "expense", categoryId: "restaurants", accountId: "courant", date: "2026-09-13" },
];

export const demoUpcoming: UpcomingExpense[] = [
  { id: "u1", label: "Électricité", amount: 38.5, categoryId: "energie", accountId: "courant", date: "2026-09-18" },
  { id: "u2", label: "Forfait mobile", amount: 15.99, categoryId: "abonnements", accountId: "courant", date: "2026-09-22" },
  { id: "u3", label: "Assurance habitation", amount: 12.4, categoryId: "assurances", accountId: "courant", date: "2026-09-25" },
];

export const demoBudgetPlan: BudgetPlan = {
  month: "2026-09",
  planned: {
    salaire: 1950,
    freelance: 150,
    logement: 650,
    energie: 45,
    assurances: 12.4,
    abonnements: 52,
    courses: 250,
    restaurants: 200,
    shopping: 120,
    transport: 100,
    loisirs: 60,
    epargne: 300,
  },
};

export const demoGoals: SavingsGoal[] = [
  { id: "g1", label: "Vacances", emoji: "🌴", tone: "lilac", saved: 870, target: 1500, monthlyContribution: 100, deadline: "2027-07" },
  { id: "g2", label: "Épargne de sécurité", emoji: "🛡️", tone: "sage", saved: 2400, target: 5000, monthlyContribution: 150 },
  { id: "g3", label: "Nouvelle voiture", emoji: "🚗", tone: "peach", saved: 3000, target: 8000, monthlyContribution: 50, deadline: "2029-06" },
];

/** Six derniers mois. Septembre est recalculé à partir des transactions. */
export const demoHistory: MonthHistoryPoint[] = [
  { month: "2026-04", expenses: 1742, savingsTotal: 4820 },
  { month: "2026-05", expenses: 1690, savingsTotal: 5050 },
  { month: "2026-06", expenses: 1735, savingsTotal: 5400 },
  { month: "2026-07", expenses: 1880, savingsTotal: 5600 },
  { month: "2026-08", expenses: 1704, savingsTotal: 5970 },
  { month: "2026-09", expenses: 0, savingsTotal: 6270 },
];

/** Août 2026, du 1er au 13 : sert à la comparaison « même date, mois précédent ». */
export const demoPreviousMonthToDate: PreviousMonthToDate = {
  logement: 650,
  abonnements: 27.47,
  courses: 104.2,
  restaurants: 128,
  shopping: 189,
  transport: 64.5,
};
