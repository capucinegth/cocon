-- =============================================================================
-- Cocon — transferts d'épargne entre comptes et récurrences sur compte désactivé
--
-- 1. Une opération d'épargne peut désigner son compte de DESTINATION (Livret A…) :
--    elle devient un transfert réel entre deux comptes Cocon (source hors épargne →
--    destination d'épargne). Le patrimoine total est inchangé par un transfert.
-- 2. La génération des récurrences ignore les règles dont un compte est désactivé
--    (aucune opération n'est plus créée sur un compte désactivé), et recopie le compte
--    de destination dans les opérations générées.
--
-- Migration ADDITIVE, compatible avec les données existantes :
--   * deux colonnes facultatives (NULL par défaut) : aucune ligne existante n'est modifiée ;
--   * les contraintes ne portent que sur ces nouvelles colonnes (NULL toujours accepté) :
--     une épargne existante sans destination reste valide (« compte de destination non précisé ») ;
--   * la fonction de génération est remplacée à l'identique (même signature, mêmes droits),
--     avec les deux seuls changements décrits ci-dessus ;
--   * aucune suppression de table, de colonne ni de donnée.
--
-- Retour arrière (si nécessaire, sans perte des données antérieures) : voir docs/SUPABASE.md.
-- =============================================================================

-- Compte de destination d'une épargne ---------------------------------------------------
alter table public.transactions
  add column transfer_account_id uuid;

alter table public.transactions
  add constraint transactions_transfer_account_fkey
    foreign key (transfer_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  add constraint transactions_transfer_check
    check (transfer_account_id is null or (type = 'saving' and transfer_account_id <> account_id));

create index transactions_transfer_account_idx
  on public.transactions (transfer_account_id)
  where transfer_account_id is not null;

alter table public.recurring_transactions
  add column transfer_account_id uuid;

alter table public.recurring_transactions
  add constraint recurring_transactions_transfer_account_fkey
    foreign key (transfer_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  add constraint recurring_transactions_transfer_check
    check (transfer_account_id is null or (type = 'saving' and transfer_account_id <> account_id));

-- Sens d'un transfert : depuis un compte hors épargne, vers un compte d'épargne -------------
-- (vérifié en base : la règle ne dépend pas de l'interface).
create function public.check_transfer_accounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.transfer_account_id is null then
    return new;
  end if;
  if exists (select 1 from public.accounts a where a.id = new.account_id and a.type = 'savings') then
    raise exception 'Une épargne se verse depuis un compte hors épargne' using errcode = '23514';
  end if;
  if not exists (select 1 from public.accounts a where a.id = new.transfer_account_id and a.type = 'savings') then
    raise exception 'Le compte de destination doit être un compte d''épargne' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_check_transfer
  before insert or update of account_id, transfer_account_id on public.transactions
  for each row execute function public.check_transfer_accounts();

create trigger recurring_transactions_check_transfer
  before insert or update of account_id, transfer_account_id on public.recurring_transactions
  for each row execute function public.check_transfer_accounts();

-- Fonction de trigger : jamais appelable directement via l'API.
revoke execute on function public.check_transfer_accounts() from public, anon, authenticated;

-- Génération des récurrences : comptes désactivés ignorés, destination recopiée ------------
create or replace function public.materialize_recurring_transactions(p_until date default null)
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
    select r.* from public.recurring_transactions r
    where r.user_id = auth.uid() and r.is_active and r.next_occurrence <= v_until
      -- Jamais d'opération sur un compte désactivé (source ou destination).
      and exists (select 1 from public.accounts a where a.id = r.account_id and a.is_active)
      and (r.transfer_account_id is null
           or exists (select 1 from public.accounts a where a.id = r.transfer_account_id and a.is_active))
    order by r.next_occurrence
    for update of r
  loop
    v_date := v_rule.next_occurrence;
    v_guard := 0;
    while v_date <= v_until and v_guard < 500 loop
      insert into public.transactions
        (user_id, account_id, transfer_account_id, category_id, goal_id, recurrence_id, type, amount_cents, description, transaction_date, source)
      values
        (v_rule.user_id, v_rule.account_id, v_rule.transfer_account_id, v_rule.category_id, v_rule.goal_id, v_rule.id,
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
