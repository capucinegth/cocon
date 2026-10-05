-- =============================================================================
-- Cocon — fonctions appelables par l'application (RPC)
--
-- Toutes s'exécutent avec les droits de l'utilisateur (security invoker) :
-- la RLS s'applique, une fonction ne peut jamais toucher les données d'un autre.
-- Les dates « du jour » sont calculées en heure de Paris.
-- =============================================================================

-- Date suivante d'une récurrence. Mensuel : même jour du mois, plafonné au dernier
-- jour (un 31 janvier donne 28/29 février puis 31 mars grâce au jour d'ancrage).
create function public.next_occurrence_date(p_date date, p_frequency text, p_anchor_day smallint default null)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_next_month date;
  v_last_day integer;
begin
  if p_frequency = 'weekly' then
    return p_date + 7;
  end if;
  v_next_month := (make_date(extract(year from p_date)::integer, extract(month from p_date)::integer, 1) + interval '1 month')::date;
  v_last_day := extract(day from (v_next_month + interval '1 month' - interval '1 day'))::integer;
  return v_next_month + (least(coalesce(p_anchor_day, extract(day from p_date)::integer), v_last_day) - 1);
end;
$$;

-- Génère les opérations dues des règles récurrentes de l'utilisateur, jusqu'à p_until
-- (aujourd'hui à Paris par défaut). Idempotent : une date déjà générée n'est jamais dupliquée.
create function public.materialize_recurring_transactions(p_until date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_until date := coalesce(p_until, (now() at time zone 'Europe/Paris')::date);
  v_rule public.recurring_transactions%rowtype;
  v_date date;
  v_count integer := 0;
  v_inserted integer;
  v_guard integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  for v_rule in
    select * from public.recurring_transactions
    where user_id = auth.uid() and is_active and next_occurrence <= v_until
    order by next_occurrence
    for update
  loop
    v_date := v_rule.next_occurrence;
    v_guard := 0;
    while v_date <= v_until and v_guard < 500 loop
      insert into public.transactions
        (user_id, account_id, category_id, goal_id, recurrence_id, type, amount_cents, description, transaction_date, source)
      values
        (v_rule.user_id, v_rule.account_id, v_rule.category_id, v_rule.goal_id, v_rule.id,
         v_rule.type, v_rule.amount_cents, v_rule.description, v_date, 'recurring')
      on conflict (recurrence_id, transaction_date) where recurrence_id is not null do nothing;
      get diagnostics v_inserted = row_count;
      v_count := v_count + v_inserted;
      v_date := public.next_occurrence_date(v_date, v_rule.frequency, v_rule.anchor_day);
      v_guard := v_guard + 1;
    end loop;
    update public.recurring_transactions set next_occurrence = v_date where id = v_rule.id;
  end loop;

  return v_count;
end;
$$;

-- Budget du mois : le crée s'il n'existe pas, en reprenant le dernier budget connu
-- (revenus prévus, épargne prévue et montants par catégorie). Renvoie le budget.
create function public.ensure_month_budget(p_month date)
returns public.budgets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_budget public.budgets;
  v_source public.budgets;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if extract(day from p_month) <> 1 then
    raise exception 'Le mois doit être le premier jour du mois' using errcode = '22023';
  end if;

  select * into v_budget from public.budgets where user_id = auth.uid() and month = p_month;
  if found then
    return v_budget;
  end if;

  select * into v_source from public.budgets
  where user_id = auth.uid() and month < p_month
  order by month desc
  limit 1;

  insert into public.budgets (user_id, month, income_target_cents, savings_target_cents)
  values (auth.uid(), p_month, coalesce(v_source.income_target_cents, 0), coalesce(v_source.savings_target_cents, 0))
  on conflict (user_id, month) do nothing
  returning * into v_budget;

  if v_budget.id is null then
    -- Créé en parallèle par une autre requête : on renvoie l'existant.
    select * into v_budget from public.budgets where user_id = auth.uid() and month = p_month;
    return v_budget;
  end if;

  if v_source.id is not null then
    insert into public.budget_categories (budget_id, category_id, amount_cents)
    select v_budget.id, bc.category_id, bc.amount_cents
    from public.budget_categories bc
    join public.categories c on c.id = bc.category_id and c.archived_at is null
    where bc.budget_id = v_source.id;
    -- Les totaux fixes / quotidien ont été recalculés par trigger.
    select * into v_budget from public.budgets where id = v_budget.id;
  end if;

  return v_budget;
end;
$$;

revoke execute on function public.next_occurrence_date(date, text, smallint) from public, anon;
revoke execute on function public.materialize_recurring_transactions(date) from public, anon;
revoke execute on function public.ensure_month_budget(date) from public, anon;
grant execute on function public.next_occurrence_date(date, text, smallint) to authenticated;
grant execute on function public.materialize_recurring_transactions(date) to authenticated;
grant execute on function public.ensure_month_budget(date) to authenticated;
