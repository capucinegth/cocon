-- =============================================================================
-- Cocon — Row Level Security
--
-- Règle unique : un utilisateur connecté ne voit et ne modifie QUE ses lignes.
--   * tables avec user_id : user_id = auth.uid() (lecture ET écriture) ;
--   * profiles : id = auth.uid() ;
--   * budget_categories (sans user_id) : le budget parent ET la catégorie doivent
--     appartenir à l'utilisateur.
-- Le rôle « anon » (visiteur non connecté) n'a accès à rien.
-- `(select auth.uid())` est évalué une seule fois par requête (recommandation Supabase).
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.savings_goals enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_categories enable row level security;

-- Droits de base. Supabase accorde par défaut TOUS les droits aux rôles de l'API sur les
-- nouvelles tables (y compris TRUNCATE, qui ignore la RLS) : on repart de zéro, puis on
-- n'accorde que le nécessaire. Rien pour les visiteurs, CRUD filtré par RLS pour les connectés.
revoke all on public.profiles, public.accounts, public.categories, public.savings_goals,
  public.recurring_transactions, public.transactions, public.budgets, public.budget_categories,
  public.savings_goals_progress
  from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts, public.categories, public.savings_goals,
  public.recurring_transactions, public.transactions, public.budgets, public.budget_categories
  to authenticated;
grant select on public.savings_goals_progress to authenticated;

-- Profils -----------------------------------------------------------------------
-- Créés par le trigger d'inscription ; jamais supprimés via l'API (suppression du compte = cascade).
create policy "profiles: lecture de son profil" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: modification de son profil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tables possédées directement (user_id) --------------------------------------------
-- Pour chaque table : lecture, création, modification et suppression limitées au propriétaire.
-- Le « with check » empêche aussi de transférer une ligne à un autre utilisateur.

create policy "accounts: lecture" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: création" on public.accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "accounts: modification" on public.accounts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "accounts: suppression" on public.accounts
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "categories: lecture" on public.categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy "categories: création" on public.categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "categories: modification" on public.categories
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "categories: suppression" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "savings_goals: lecture" on public.savings_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "savings_goals: création" on public.savings_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "savings_goals: modification" on public.savings_goals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "savings_goals: suppression" on public.savings_goals
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "recurring_transactions: lecture" on public.recurring_transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recurring_transactions: création" on public.recurring_transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recurring_transactions: modification" on public.recurring_transactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recurring_transactions: suppression" on public.recurring_transactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "transactions: lecture" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: création" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "transactions: modification" on public.transactions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "transactions: suppression" on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "budgets: lecture" on public.budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "budgets: création" on public.budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "budgets: modification" on public.budgets
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "budgets: suppression" on public.budgets
  for delete to authenticated using (user_id = (select auth.uid()));

-- Budgets par catégorie : propriété vérifiée via le budget parent et la catégorie ---------
create policy "budget_categories: lecture" on public.budget_categories
  for select to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
  ));

create policy "budget_categories: création" on public.budget_categories
  for insert to authenticated
  with check (
    exists (
      select 1 from public.budgets b
      where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = budget_categories.category_id and c.user_id = (select auth.uid())
    )
  );

create policy "budget_categories: modification" on public.budget_categories
  for update to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.budgets b
      where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.categories c
      where c.id = budget_categories.category_id and c.user_id = (select auth.uid())
    )
  );

create policy "budget_categories: suppression" on public.budget_categories
  for delete to authenticated
  using (exists (
    select 1 from public.budgets b
    where b.id = budget_categories.budget_id and b.user_id = (select auth.uid())
  ));

-- Fonctions de trigger : jamais appelables directement via l'API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.budget_categories_sync_targets() from public, anon, authenticated;
revoke execute on function public.categories_sync_budget_targets() from public, anon, authenticated;
-- Recalcul des totaux d'un budget : appelé par les triggers avec les droits de l'utilisateur.
-- Inoffensif (recalcule des valeurs dérivées) et limité par la RLS à ses propres budgets.
revoke execute on function public.recompute_budget_targets(uuid) from public, anon;
grant execute on function public.recompute_budget_targets(uuid) to authenticated;
