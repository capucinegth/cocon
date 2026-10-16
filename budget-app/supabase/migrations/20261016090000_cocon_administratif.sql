-- =============================================================================
-- Cocon — module « Administratif » (Mes papiers) : documents, informations, échéances
--
-- Migration ADDITIVE : trois nouvelles tables, aucune table existante modifiée,
-- aucune donnée existante touchée. Les fichiers eux-mêmes sont dans un espace de
-- stockage PRIVÉ (migration suivante) ; ces tables n'en gardent que la fiche.
--
-- Mêmes principes que le reste de Cocon :
--   * chaque ligne appartient à un utilisateur (user_id = auth.uid()) ;
--   * clés étrangères composites (id, user_id) : une information ou une échéance ne peut
--     désigner qu'un document du MÊME utilisateur ;
--   * montants en centimes ;
--   * tables créées SANS « if not exists » : la migration échoue plutôt que de se mélanger
--     à des tables existantes.
--
-- Rien n'est relié automatiquement au Budget : une information extraite n'est utilisable
-- ailleurs qu'après validation explicite de l'utilisateur (status = 'valide').
--
-- Retour arrière (aucune autre donnée de Cocon n'est concernée) : voir docs/SUPABASE.md.
-- =============================================================================

-- Documents ------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('professionnel', 'sante', 'impots', 'assurances')),
  -- Type précis (fiche de paie, avis d'imposition…) : catalogue tenu par l'application.
  document_type text not null check (document_type ~ '^[a-z_]{2,40}$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  -- Fichier dans l'espace privé « documents » : toujours sous le dossier de son propriétaire.
  file_path text not null unique check (split_part(file_path, '/', 1) = user_id::text),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 20971520),
  page_count smallint check (page_count is null or page_count between 1 and 200),
  document_date date,
  -- Période couverte (« septembre 2026 », « 2026 ») : année seule, ou année + mois.
  period_year smallint check (period_year is null or period_year between 1900 and 2100),
  period_month smallint check (period_month is null or (period_month between 1 and 12 and period_year is not null)),
  -- Le classement proposé par Cocon reste « à vérifier » tant que l'utilisateur ne l'a pas confirmé.
  classification_status text not null default 'a_verifier' check (classification_status in ('a_verifier', 'confirme')),
  classification_source text not null default 'utilisateur' check (classification_source in ('nom_fichier', 'utilisateur')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index documents_user_category_idx on public.documents (user_id, category);
create index documents_user_created_idx on public.documents (user_id, created_at desc);

-- Informations d'un document (simples, typées, vérifiables) ------------------------------
-- Une information est « proposée » (à vérifier) ou « validée » par l'utilisateur.
-- Exactement une valeur est renseignée : texte, montant (centimes) ou date
-- (un mois = le 1er du mois, une année = le 1er janvier).
create table public.document_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  field_key text not null check (field_key ~ '^[a-z_]{2,40}$'),
  value_text text check (value_text is null or char_length(value_text) between 1 and 200),
  value_amount_cents bigint,
  value_date date,
  status text not null default 'propose' check (status in ('propose', 'valide')),
  source text not null default 'utilisateur' check (source in ('nom_fichier', 'utilisateur', 'extraction')),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(value_text, value_amount_cents, value_date) = 1),
  check ((status = 'valide') = (validated_at is not null)),
  unique (document_id, field_key),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

-- Échéances (fin de contrat, date limite, renouvellement…) ------------------------------
create table public.document_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  due_date date not null,
  kind text not null default 'echeance' check (kind in ('echeance', 'fin_contrat', 'date_limite', 'renouvellement', 'autre')),
  -- Marquée comme traitée (reste visible dans l'historique du document).
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

create index document_deadlines_user_due_idx on public.document_deadlines (user_id, due_date);

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger document_fields_updated_at before update on public.document_fields
  for each row execute function public.set_updated_at();
create trigger document_deadlines_updated_at before update on public.document_deadlines
  for each row execute function public.set_updated_at();

-- Sécurité : rien pour les visiteurs, lecture / écriture limitées au propriétaire -------------
alter table public.documents enable row level security;
alter table public.document_fields enable row level security;
alter table public.document_deadlines enable row level security;

revoke all on public.documents, public.document_fields, public.document_deadlines from anon, authenticated;
grant select, insert, update, delete on public.documents, public.document_fields, public.document_deadlines to authenticated;

create policy "documents: lecture" on public.documents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "documents: création" on public.documents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "documents: modification" on public.documents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "documents: suppression" on public.documents
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "document_fields: lecture" on public.document_fields
  for select to authenticated using (user_id = (select auth.uid()));
create policy "document_fields: création" on public.document_fields
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "document_fields: modification" on public.document_fields
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "document_fields: suppression" on public.document_fields
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "document_deadlines: lecture" on public.document_deadlines
  for select to authenticated using (user_id = (select auth.uid()));
create policy "document_deadlines: création" on public.document_deadlines
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "document_deadlines: modification" on public.document_deadlines
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "document_deadlines: suppression" on public.document_deadlines
  for delete to authenticated using (user_id = (select auth.uid()));
