# Cocon × Supabase — mise en place et points à valider

Les migrations de ce dossier **n'ont été appliquées à aucune base réelle**. Elles ont été testées
uniquement sur des bases locales jetables (PostgreSQL 16 + Auth Supabase + PostgREST 12).
Avant toute application, valider chaque point ci-dessous.

## 1. Le bon projet, et lui seul

- [ ] Créer (ou choisir) un projet Supabase **dédié à Cocon**. Ne pas réutiliser le projet d'une autre
      application (ex. « plateforme-partenariats ») : les tables `profiles`, `accounts`, `categories`…
      pourraient entrer en conflit, et les utilisateurs seraient partagés.
- [ ] Vérifier dans le tableau de bord le **nom** et la **référence** du projet (Project Settings → General).
- [ ] Vérifier que le schéma `public` de ce projet est **vide** (Table Editor). La première migration
      échoue volontairement si une table du même nom existe déjà (pas de `if not exists`) : elle ne
      se mélange jamais à des données existantes.

## 2. Appliquer les migrations (dans l'ordre)

| Fichier | Contenu |
| --- | --- |
| `20261005090000_cocon_schema.sql` | Tables, contraintes, index, vue `savings_goals_progress`, triggers de cohérence |
| `20261005090100_cocon_new_user.sql` | À l'inscription : profil, 13 catégories, 3 comptes par défaut |
| `20261005090200_cocon_rls.sql` | RLS sur toutes les tables, droits minimaux, retrait des droits par défaut |
| `20261005090300_cocon_functions.sql` | Récurrences (`materialize_recurring_transactions`), budget du mois (`ensure_month_budget`) |

Deux possibilités :
- **Supabase CLI** : `supabase link --project-ref <ref>` puis `supabase db push` (affiche la liste avant d'appliquer).
- **SQL Editor** : exécuter les 4 fichiers dans l'ordre.

Aucune migration ne contient de `DROP`, `TRUNCATE` ou `DELETE`. Elles sont uniquement additives.

> Ne jamais appliquer `supabase/tests/support/local-auth-shim.sql` : il ne sert qu'aux tests locaux.

## 3. Authentification (Authentication → Settings)

- [ ] **Site URL** : l'adresse de production de Cocon.
- [ ] **Redirect URLs** : ajouter `https://<adresse-de-cocon>/auth/callback` (et `http://localhost:3000/auth/callback` pour le développement).
- [ ] Confirmation par e-mail : recommandée (activée par défaut). L'application affiche alors
      « Vérifie ta boîte mail » après l'inscription.
- [ ] Longueur minimale du mot de passe : 8 (l'interface exige déjà 8 caractères).

## 4. Variables d'environnement

| Variable | Valeur | Où |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet (Project Settings → API) | `.env.local` / hébergeur |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Clé **publique** | `.env.local` / hébergeur |

- La clé publique est faite pour être visible dans le navigateur : la sécurité repose sur la RLS.
- La clé **secrète / service_role** ne doit jamais être utilisée par Cocon. L'application la refuse
  si elle est fournie par erreur et affiche un message. Aucun fichier `.env*` n'est commité.

## 5. Sécurité — ce qui a été vérifié

- RLS activée sur les 8 tables, avec une politique par opération (lecture, création, modification,
  suppression) limitée à `auth.uid()`. Les politiques ont été **réellement testées** avec deux comptes
  (`tests/db/rls.test.ts`, `tests/integration/supabase-repository.test.ts`, `tests/e2e/supabase/isolation.spec.ts`).
- Tests de mutation : en désactivant la RLS sur `transactions`, les tests échouent (3 en base,
  6 côté application) ; en remettant les droits par défaut de Supabase, le test TRUNCATE échoue.
- Clés étrangères composites `(id, user_id)` : impossible de rattacher une opération à la
  catégorie, au compte ou à l'objectif d'un autre utilisateur.
- Visiteur non connecté (`anon`) : aucun accès aux tables, à la vue ni aux fonctions.
- Fonctions appelables en `security invoker` (soumises à la RLS) ; la seule fonction `security definer`
  (préparation du compte à l'inscription) n'est pas appelable via l'API.
- Les droits accordés par défaut par Supabase sur les nouvelles tables (dont `TRUNCATE`, qui ignore
  la RLS) sont retirés, puis seuls les droits nécessaires sont accordés.

## 6. Après application — vérification rapide

1. Créer un compte depuis `/inscription` → l'accueil affiche « Bienvenue dans Cocon ».
2. Table Editor : `profiles` contient 1 ligne, `categories` 13, `accounts` 3 pour ce compte.
3. Ajouter une dépense, recharger, se connecter depuis un autre navigateur : elle est là.
4. Créer un second compte : il ne voit aucune donnée du premier.
