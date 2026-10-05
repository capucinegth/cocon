-- =============================================================================
-- Cocon — schéma initial
--
-- Principes :
--   * montants en centimes (bigint) : aucun problème d'arrondi en virgule flottante ;
--   * chaque ligne appartient à un utilisateur Supabase Auth (user_id = auth.uid()) ;
--   * clés étrangères composites (id, user_id) : une opération ne peut référencer
--     qu'un compte / une catégorie / un objectif du MÊME utilisateur ;
--   * rien n'est stocké deux fois : soldes et montants épargnés sont calculés.
--
-- Sécurité : les tables sont créées SANS « if not exists ». Si cette migration est
-- lancée par erreur sur une base qui possède déjà ces tables (une autre application),
-- elle échoue au lieu de se mélanger à des données existantes.
-- =============================================================================

-- Horodatage de mise à jour --------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profils ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  -- Préférences d'interface (mode discret, notifications…) : suivent l'utilisateur d'un appareil à l'autre.
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Comptes financiers ------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('checking', 'savings', 'cash', 'joint', 'other')),
  -- Solde au moment où le compte est ajouté à Cocon ; le solde courant est calculé.
  initial_balance_cents bigint not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- Catégories --------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- fixed = charge fixe, variable = dépense du quotidien, income = revenu, saving = épargne
  type text not null check (type in ('fixed', 'variable', 'income', 'saving')),
  icon text not null default '📦' check (char_length(icon) between 1 and 16),
  color text not null default 'peach' check (color in ('blush', 'lilac', 'sage', 'peach')),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  -- Une catégorie utilisée n'est jamais supprimée : elle est archivée.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index categories_user_active_name_key
  on public.categories (user_id, lower(name))
  where archived_at is null;

-- Objectifs d'épargne -------------------------------------------------------------
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default '🎯' check (char_length(icon) between 1 and 16),
  color text not null default 'lilac' check (color in ('blush', 'lilac', 'sage', 'peach')),
  target_amount_cents bigint not null check (target_amount_cents > 0),
  -- Déjà épargné avant de suivre l'objectif dans Cocon. Le montant actuel = ceci + versements.
  initial_amount_cents bigint not null default 0 check (initial_amount_cents >= 0),
  monthly_contribution_cents bigint not null default 0 check (monthly_contribution_cents >= 0),
  -- Mois cible (toujours le 1er du mois).
  target_date date check (target_date is null or extract(day from target_date) = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- Opérations récurrentes (règles) ------------------------------------------------
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  goal_id uuid,
  type text not null check (type in ('expense', 'income', 'saving')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 100000000000),
  description text not null default '' check (char_length(description) <= 80),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  -- Prochaine date à générer ; anchor_day garde le jour d'origine (un 31 reste un « fin de mois »).
  next_occurrence date not null,
  anchor_day smallint check (anchor_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete set null (goal_id),
  check (goal_id is null or type = 'saving')
);

-- Opérations ------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  goal_id uuid,
  recurrence_id uuid,
  type text not null check (type in ('expense', 'income', 'saving')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 100000000000),
  description text not null default '' check (char_length(description) <= 80),
  note text check (note is null or char_length(note) <= 280),
  -- Date calendaire (sans heure ni fuseau) : une dépense du 13 reste au 13, partout.
  transaction_date date not null,
  -- Préparation d'un futur import bancaire (dédoublonnage). Aucune connexion bancaire en V3.
  source text not null default 'manual' check (source in ('manual', 'recurring', 'import')),
  external_id text check (external_id is null or char_length(external_id) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
  foreign key (goal_id, user_id) references public.savings_goals (id, user_id) on delete set null (goal_id),
  foreign key (recurrence_id, user_id) references public.recurring_transactions (id, user_id) on delete set null (recurrence_id),
  check (goal_id is null or type = 'saving')
);

create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc);
create index transactions_goal_idx on public.transactions (goal_id) where goal_id is not null;
-- Une règle récurrente ne génère jamais deux fois la même date.
create unique index transactions_recurrence_date_key
  on public.transactions (recurrence_id, transaction_date)
  where recurrence_id is not null;
create unique index transactions_user_external_key
  on public.transactions (user_id, external_id)
  where external_id is not null;

-- Budgets mensuels ------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Toujours le 1er du mois.
  month date not null check (extract(day from month) = 1),
  income_target_cents bigint not null default 0 check (income_target_cents >= 0),
  -- Tenus à jour automatiquement à partir de budget_categories (voir trigger plus bas).
  fixed_expenses_target_cents bigint not null default 0 check (fixed_expenses_target_cents >= 0),
  variable_expenses_target_cents bigint not null default 0 check (variable_expenses_target_cents >= 0),
  savings_target_cents bigint not null default 0 check (savings_target_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id)
);

create index budget_categories_category_idx on public.budget_categories (category_id);

-- Horodatages ----------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();
create trigger recurring_transactions_updated_at before update on public.recurring_transactions
  for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
create trigger budget_categories_updated_at before update on public.budget_categories
  for each row execute function public.set_updated_at();

-- Totaux fixes / quotidien du budget = somme des budgets par catégorie -----------------
create function public.recompute_budget_targets(p_budget_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.budgets b
  set
    fixed_expenses_target_cents = coalesce((
      select sum(bc.amount_cents)
      from public.budget_categories bc
      join public.categories c on c.id = bc.category_id
      where bc.budget_id = b.id and c.type = 'fixed'
    ), 0),
    variable_expenses_target_cents = coalesce((
      select sum(bc.amount_cents)
      from public.budget_categories bc
      join public.categories c on c.id = bc.category_id
      where bc.budget_id = b.id and c.type = 'variable'
    ), 0)
  where b.id = p_budget_id;
$$;

create function public.budget_categories_sync_targets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_budget_targets(old.budget_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.recompute_budget_targets(new.budget_id);
  end if;
  return null;
end;
$$;

create trigger budget_categories_sync_targets
  after insert or update or delete on public.budget_categories
  for each row execute function public.budget_categories_sync_targets();

-- Une catégorie qui change de type (fixe ↔ quotidien) met à jour les budgets concernés.
create function public.categories_sync_budget_targets()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_budget_id uuid;
begin
  for v_budget_id in
    select bc.budget_id from public.budget_categories bc where bc.category_id = new.id
  loop
    perform public.recompute_budget_targets(v_budget_id);
  end loop;
  return null;
end;
$$;

create trigger categories_sync_budget_targets
  after update of type on public.categories
  for each row
  when (old.type is distinct from new.type)
  execute function public.categories_sync_budget_targets();

-- Montant épargné par objectif : calculé, jamais stocké --------------------------------
create view public.savings_goals_progress
with (security_invoker = true)
as
select
  g.*,
  g.initial_amount_cents + coalesce((
    select sum(t.amount_cents)
    from public.transactions t
    where t.goal_id = g.id
      and t.type = 'saving'
      and t.transaction_date <= (now() at time zone 'Europe/Paris')::date
  ), 0) as current_amount_cents
from public.savings_goals g;
