-- =============================================================================
-- Cocon — préparation automatique d'un nouvel utilisateur
--
-- À l'inscription (insertion dans auth.users), on crée :
--   * le profil (nom d'affichage tiré des métadonnées, sinon du début de l'e-mail) ;
--   * les catégories par défaut (identiques à la V2) ;
--   * trois comptes de base : Compte courant, Espèces, Livret A.
-- Aucune donnée financière n'est créée : un nouvel utilisateur démarre à zéro.
-- =============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  ), 60);

  insert into public.profiles (id, display_name) values (new.id, v_name);

  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order)
  values
    (new.id, 'Logement', 'fixed', '🏠', 'lilac', true, 10),
    (new.id, 'Courses', 'variable', '🧺', 'sage', true, 20),
    (new.id, 'Transport', 'variable', '🚆', 'lilac', true, 30),
    (new.id, 'Restaurants', 'variable', '🍝', 'peach', true, 40),
    (new.id, 'Loisirs', 'variable', '🎟️', 'blush', true, 50),
    (new.id, 'Shopping', 'variable', '🛍️', 'blush', true, 60),
    (new.id, 'Santé', 'variable', '🌿', 'sage', true, 70),
    (new.id, 'Abonnements', 'fixed', '📱', 'lilac', true, 80),
    (new.id, 'Autres', 'variable', '📦', 'peach', true, 90),
    (new.id, 'Salaire', 'income', '💼', 'sage', true, 100),
    (new.id, 'Freelance', 'income', '✨', 'blush', true, 110),
    (new.id, 'Autres revenus', 'income', '💶', 'peach', true, 120),
    (new.id, 'Épargne', 'saving', '🌱', 'sage', true, 130);

  insert into public.accounts (user_id, name, type, sort_order)
  values
    (new.id, 'Compte courant', 'checking', 10),
    (new.id, 'Espèces', 'cash', 20),
    (new.id, 'Livret A', 'savings', 30);

  return new;
end;
$$;

-- La fonction ne doit être appelée que par le trigger (jamais via l'API).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
