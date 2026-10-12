/**
 * Dépôt Supabase : les vraies données de l'utilisateur connecté.
 * Chaque requête passe par la RLS : un utilisateur ne peut lire ou écrire que ses lignes.
 * Aucune clé secrète ici — uniquement la session de l'utilisateur.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { findCategory } from "@/config/categories";
import { sortCategories } from "@/store/budget-state";
import type { BudgetState } from "@/types/budget-data";
import type { RecurringRule } from "@/types/finance";
import {
  accountFromRow,
  accountToRow,
  categoryFromRow,
  categoryToRow,
  goalFromRow,
  goalToRow,
  monthToDate,
  planFromRow,
  profileFromRow,
  recurringFromRow,
  recurringToRow,
  toCents,
  transactionFromRow,
  transactionToRow,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type GoalRow,
  type ProfileRow,
  type RecurringRow,
  type TransactionRow,
} from "./mappers";
import { RepositoryError, type BudgetRepository } from "./repository";

const PAGE_SIZE = 1000;

const TRANSACTION_COLUMNS =
  "id, account_id, category_id, goal_id, recurrence_id, type, amount_cents, description, note, transaction_date";
const RECURRING_COLUMNS =
  "id, account_id, category_id, goal_id, type, amount_cents, description, frequency, next_occurrence, anchor_day, is_active";
const GOAL_COLUMNS =
  "id, name, icon, color, target_amount_cents, initial_amount_cents, monthly_contribution_cents, target_date, current_amount_cents";

/** Traduit une erreur Supabase / réseau en message clair (jamais de détail technique à l'écran). */
export function toRepositoryError(error: Pick<PostgrestError, "message" | "code"> & { status?: number }, action: string): RepositoryError {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code.startsWith("PGRST30") || error.status === 401 || /\bjwt\b/i.test(message)) {
    return new RepositoryError("Ta session a expiré. Reconnecte-toi pour continuer.", "auth", message);
  }
  if (/fetch|network|load failed|timeout/i.test(message) || error.status === 0) {
    return new RepositoryError(`Connexion impossible pour ${action}. Vérifie ta connexion Internet puis réessaie.`, "network", message);
  }
  if (code === "23505") return new RepositoryError("Cet élément existe déjà (même nom).", "conflict", message);
  if (code === "23503") return new RepositoryError("Cet élément est encore utilisé ailleurs : action impossible.", "conflict", message);
  if (code === "23514" || code === "22P02" || code === "22023") {
    return new RepositoryError("Une des valeurs saisies n'est pas acceptée. Vérifie le formulaire.", "validation", message);
  }
  if (code === "42501") return new RepositoryError("Action refusée : ces données ne t'appartiennent pas.", "server", message);
  return new RepositoryError(`Impossible de ${action} pour le moment. Réessaie dans un instant.`, "server", message);
}

type Result<T> = { data: T | null; error: PostgrestError | null; status?: number };

async function must<T>(query: PromiseLike<Result<T>>, action: string): Promise<T> {
  let result: Result<T>;
  try {
    result = await query;
  } catch (error) {
    throw toRepositoryError({ message: error instanceof Error ? error.message : String(error), code: "", status: 0 }, action);
  }
  if (result.error) throw toRepositoryError({ ...result.error, status: result.status }, action);
  return result.data as T;
}

/** Vérifie qu'une modification a bien touché une ligne (sinon : supprimée ailleurs, ou pas à soi). */
function expectRow(rows: unknown[] | null, what: string) {
  if (!rows || rows.length === 0) {
    throw new RepositoryError(`${what} n'existe plus (peut-être supprimé depuis un autre appareil). Actualise la page.`, "conflict");
  }
}

export function createSupabaseRepository(client: SupabaseClient): BudgetRepository {
  async function currentUser() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      throw new RepositoryError("Ta session a expiré. Reconnecte-toi pour continuer.", "auth", error?.message);
    }
    return data.user;
  }

  async function loadTransactions(): Promise<TransactionRow[]> {
    const rows: TransactionRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await must<TransactionRow[]>(
        client
          .from("transactions")
          .select(TRANSACTION_COLUMNS)
          .order("transaction_date", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1),
        "charger tes opérations",
      );
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  async function ensureBudget(month: string): Promise<{ id: string }> {
    return must<{ id: string }>(client.rpc("ensure_month_budget", { p_month: monthToDate(month) }).single(), "préparer le budget du mois");
  }

  return {
    source: "supabase",

    async load(today) {
      const user = await currentUser();
      // Génère d'abord les opérations récurrentes arrivées à échéance (idempotent).
      await must(client.rpc("materialize_recurring_transactions", { p_until: today }), "générer tes opérations récurrentes");

      const [profileRow, accountRows, categoryRows, goalRows, recurringRows, budgetRows, transactionRows] = await Promise.all([
        must<ProfileRow | null>(client.from("profiles").select("id, display_name, preferences").eq("id", user.id).maybeSingle(), "charger ton profil"),
        must<AccountRow[]>(
          client.from("accounts").select("id, name, type, initial_balance_cents, is_active, sort_order").order("sort_order").order("created_at"),
          "charger tes comptes",
        ),
        must<CategoryRow[]>(
          client.from("categories").select("id, name, type, icon, color, sort_order, archived_at").order("sort_order").order("created_at"),
          "charger tes catégories",
        ),
        must<GoalRow[]>(client.from("savings_goals_progress").select(GOAL_COLUMNS).order("created_at"), "charger tes objectifs"),
        must<RecurringRow[]>(client.from("recurring_transactions").select(RECURRING_COLUMNS).order("next_occurrence"), "charger tes récurrences"),
        must<BudgetRow[]>(
          client
            .from("budgets")
            .select("id, month, income_target_cents, savings_target_cents, budget_categories(category_id, amount_cents)")
            .order("month"),
          "charger tes budgets",
        ),
        loadTransactions(),
      ]);

      const categories = sortCategories(categoryRows.map(categoryFromRow));
      const categoryLabel = (id: string) => findCategory(categories, id).label;
      const recurring = recurringRows.map((row) => recurringFromRow(row, categoryLabel));
      const rules = new Map<string, RecurringRule>(recurring.map((rule) => [rule.id, rule]));

      return {
        today,
        categories,
        accounts: accountRows.map(accountFromRow),
        transactions: transactionRows.map((row) => transactionFromRow(row, rules, categoryLabel)),
        recurring,
        plans: budgetRows.map(planFromRow),
        goals: goalRows.map(goalFromRow),
        history: null,
        openingBalances: null,
        profile: profileRow
          ? profileFromRow(profileRow, user.email ?? undefined)
          : { id: user.id, displayName: "", email: user.email ?? undefined, preferences: {} },
      } satisfies BudgetState;
    },

    async createTransaction(transaction, rule) {
      if (rule) await must(client.from("recurring_transactions").insert(recurringToRow(rule)), "enregistrer la récurrence");
      try {
        await must(client.from("transactions").insert(transactionToRow(transaction)), "enregistrer l'opération");
      } catch (error) {
        // Pas de règle orpheline si l'opération n'a pas pu être créée.
        if (rule) await client.from("recurring_transactions").delete().eq("id", rule.id);
        throw error;
      }
    },

    async updateTransaction(transaction) {
      const { id, ...row } = transactionToRow(transaction);
      const rows = await must<unknown[]>(client.from("transactions").update(row).eq("id", id).select("id"), "modifier l'opération");
      expectRow(rows, "Cette opération");
    },

    async deleteTransaction(transaction, ruleId) {
      await must(client.from("transactions").delete().eq("id", transaction.id), "supprimer l'opération");
      if (ruleId) await must(client.from("recurring_transactions").delete().eq("id", ruleId), "supprimer la récurrence");
    },

    async createCategory(category) {
      const last = await must<{ sort_order: number }[]>(
        client.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1),
        "créer la catégorie",
      );
      await must(client.from("categories").insert(categoryToRow(category, (last[0]?.sort_order ?? 0) + 10)), "créer la catégorie");
    },

    async updateCategory(category) {
      const { name, icon, color } = categoryToRow(category);
      const rows = await must<unknown[]>(
        client.from("categories").update({ name, icon, color }).eq("id", category.id).select("id"),
        "modifier la catégorie",
      );
      expectRow(rows, "Cette catégorie");
    },

    async archiveCategory(categoryId) {
      const rows = await must<unknown[]>(
        client.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", categoryId).select("id"),
        "archiver la catégorie",
      );
      expectRow(rows, "Cette catégorie");
    },

    async restoreCategory(categoryId) {
      const rows = await must<unknown[]>(
        client.from("categories").update({ archived_at: null }).eq("id", categoryId).select("id"),
        "restaurer la catégorie",
      );
      expectRow(rows, "Cette catégorie");
    },

    async setCategoryBudget(month, categoryId, amount) {
      const budget = await ensureBudget(month);
      await must(
        client
          .from("budget_categories")
          .upsert({ budget_id: budget.id, category_id: categoryId, amount_cents: toCents(amount) }, { onConflict: "budget_id,category_id" }),
        "enregistrer le budget",
      );
    },

    async setMonthTargets(month, targets) {
      const budget = await ensureBudget(month);
      const patch: Record<string, number> = {};
      if (targets.incomeTarget !== undefined) patch.income_target_cents = toCents(targets.incomeTarget);
      if (targets.savingsTarget !== undefined) patch.savings_target_cents = toCents(targets.savingsTarget);
      await must(client.from("budgets").update(patch).eq("id", budget.id), "enregistrer le budget");
    },

    async createGoal(goal) {
      await must(client.from("savings_goals").insert(goalToRow(goal)), "créer l'objectif");
    },

    async updateGoal(goal) {
      const { id, ...row } = goalToRow(goal);
      const rows = await must<unknown[]>(client.from("savings_goals").update(row).eq("id", id).select("id"), "modifier l'objectif");
      expectRow(rows, "Cet objectif");
    },

    async deleteGoal(goalId) {
      await must(client.from("savings_goals").delete().eq("id", goalId), "supprimer l'objectif");
    },

    async updateRecurring(ruleId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.label !== undefined) row.description = patch.label.trim();
      if (patch.amount !== undefined) row.amount_cents = toCents(patch.amount);
      if (patch.isActive !== undefined) row.is_active = patch.isActive;
      if (patch.nextOccurrence !== undefined) row.next_occurrence = patch.nextOccurrence;
      if (patch.frequency !== undefined) row.frequency = patch.frequency;
      if ("anchorDay" in patch) row.anchor_day = patch.anchorDay ?? null;
      if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
      if (patch.accountId !== undefined) row.account_id = patch.accountId;
      const rows = await must<unknown[]>(
        client.from("recurring_transactions").update(row).eq("id", ruleId).select("id"),
        "modifier la récurrence",
      );
      expectRow(rows, "Cette récurrence");
    },

    async deleteRecurring(ruleId) {
      await must(client.from("recurring_transactions").delete().eq("id", ruleId), "supprimer la récurrence");
    },

    async updateAccount(account) {
      const rows = await must<unknown[]>(
        client.from("accounts").update(accountToRow(account)).eq("id", account.id).select("id"),
        "modifier le compte",
      );
      expectRow(rows, "Ce compte");
    },

    async reorderAccounts(orderedIds) {
      // Positions espacées de 10, comme à la création des comptes (10, 20, 30).
      for (const [index, id] of orderedIds.entries()) {
        const rows = await must<unknown[]>(
          client.from("accounts").update({ sort_order: (index + 1) * 10 }).eq("id", id).select("id"),
          "réordonner tes comptes",
        );
        expectRow(rows, "Ce compte");
      }
    },

    async updateProfile(userId, profile) {
      const rows = await must<unknown[]>(
        client
          .from("profiles")
          .update({ display_name: profile.displayName.trim().slice(0, 60), preferences: profile.preferences })
          .eq("id", userId)
          .select("id"),
        "enregistrer ton profil",
      );
      expectRow(rows, "Ce profil");
    },
  };
}
