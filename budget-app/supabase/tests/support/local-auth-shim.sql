-- =============================================================================
-- UNIQUEMENT POUR LES TESTS LOCAUX — ne jamais appliquer sur Supabase.
--
-- Reproduit le strict nécessaire de l'environnement Supabase sur un PostgreSQL nu :
-- schéma auth, table auth.users, fonction auth.uid() (même définition que Supabase),
-- rôles anon / authenticated / service_role. Permet de tester les vraies migrations
-- et les vraies politiques RLS avec plusieurs utilisateurs.
-- =============================================================================
-- Les rôles sont globaux au serveur : on ne les crée qu'une fois.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end
$$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Définition identique à celle de Supabase.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated, service_role;

-- Comme sur Supabase hébergé : tout nouvel objet du schéma public est, par défaut,
-- entièrement accessible aux rôles de l'API. Les migrations doivent donc retirer
-- explicitement ce qui ne doit pas l'être (sinon les tests le détectent).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
