-- =============================================================================
-- Cocon — module « Administratif » : dossiers personnels
--
-- Migration ADDITIVE :
--   * une nouvelle table « document_folders » (les dossiers que l'utilisateur crée lui-même) ;
--   * une nouvelle colonne FACULTATIVE « documents.folder_id » (vide pour tous les documents
--     existants : aucun document n'est déplacé, modifié ni supprimé).
--
-- Un document garde toujours sa catégorie ; le dossier est un rangement en plus.
-- Supprimer un dossier ne supprime JAMAIS ses documents : ils sortent simplement du dossier
-- (on delete set null, uniquement sur folder_id).
-- Clé étrangère composite (folder_id, user_id) : un document ne peut être rangé que dans un
-- dossier du MÊME utilisateur.
--
-- Retour arrière (aucune autre donnée de Cocon n'est concernée) : voir docs/SUPABASE.md.
-- =============================================================================

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  emoji text not null default '📁' check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- Deux dossiers ne portent pas le même nom (sans tenir compte des majuscules ni des espaces autour).
create unique index document_folders_user_name_idx on public.document_folders (user_id, lower(btrim(name)));

alter table public.documents add column folder_id uuid;
alter table public.documents
  add constraint documents_folder_fkey foreign key (folder_id, user_id)
  references public.document_folders (id, user_id) on delete set null (folder_id);
create index documents_user_folder_idx on public.documents (user_id, folder_id) where folder_id is not null;

create trigger document_folders_updated_at before update on public.document_folders
  for each row execute function public.set_updated_at();

-- Sécurité : rien pour les visiteurs, lecture / écriture limitées au propriétaire -------------
alter table public.document_folders enable row level security;

revoke all on public.document_folders from anon, authenticated;
grant select, insert, update, delete on public.document_folders to authenticated;

create policy "document_folders: lecture" on public.document_folders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "document_folders: création" on public.document_folders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "document_folders: modification" on public.document_folders
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "document_folders: suppression" on public.document_folders
  for delete to authenticated using (user_id = (select auth.uid()));
