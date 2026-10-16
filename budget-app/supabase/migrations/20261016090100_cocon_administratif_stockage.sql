-- =============================================================================
-- Cocon — espace de stockage PRIVÉ des documents administratifs
--
-- * Espace « documents » non public : aucune URL publique ; les fichiers ne se lisent
--   qu'avec la session de leur propriétaire, ou via un lien temporaire signé (60 s).
-- * Taille maximale 20 Mo, formats acceptés : PDF, JPEG, PNG, WebP.
-- * Chemin d'un fichier : <user_id>/<document_id>/<nom>. Chaque utilisateur ne peut
--   lire, créer ou supprimer que dans SON dossier ; aucun fichier n'est modifiable
--   (un nouveau fichier = un nouveau document).
--
-- Migration ADDITIVE : n'ajoute que cet espace et ses règles. Elle échoue si un espace
-- « documents » existe déjà (aucun mélange avec un espace existant).
-- Retour arrière : voir docs/SUPABASE.md.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

create policy "documents (stockage) : lecture de ses fichiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents (stockage) : dépôt dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents (stockage) : suppression de ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
