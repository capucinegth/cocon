# Cocon × Supabase — mise en place et points à valider

Toutes les migrations sont d'abord testées sur des bases PostgreSQL locales jetables (vraies migrations,
vraies politiques RLS). Avant toute application à une base réelle, valider chaque point ci-dessous.
Projet existant déjà en service : voir **« Mettre à jour un projet existant »**.

Projet cible : le projet Supabase **dédié à Cocon**. Son nom exact n'est pas écrit dans le dépôt :
il est fourni au moment de la connexion (`--project` ou `SUPABASE_PROJECT_NAME`), et le script de
migration vérifie qu'il correspond bien à l'URL utilisée par l'application.

## 1. Le bon projet, et lui seul

- [ ] Créer (ou choisir) un projet Supabase **dédié à Cocon**. Ne pas réutiliser le projet d'une autre
      application : les tables `profiles`, `accounts`, `categories`… pourraient entrer en conflit,
      et les utilisateurs seraient partagés.
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
| `20261012090000_cocon_transferts_epargne.sql` | V3 : épargne = transfert vers un compte d'épargne (`transfer_account_id`), aucune récurrence générée sur un compte désactivé |
| `20261016090000_cocon_administratif.sql` | Mes papiers : tables `documents`, `document_fields`, `document_deadlines` (RLS, contraintes) |
| `20261016090100_cocon_administratif_stockage.sql` | Mes papiers : espace de stockage **privé** `documents` (20 Mo, PDF / JPEG / PNG / WebP) et ses règles d'accès |

Trois possibilités :
- **Script de Cocon (recommandé)** — vérifie tout avant d'écrire quoi que ce soit :
  ```bash
  node scripts/supabase-migrate.mjs --project "<nom exact du projet>"           # vérification seule
  node scripts/supabase-migrate.mjs --project "<nom exact du projet>" --apply   # application
  ```
  Le nom peut aussi être fourni par la variable `SUPABASE_PROJECT_NAME` (sans `--project`) ; si les
  deux sont présents, ils doivent être identiques. Le nom n'est pas un secret, mais il n'est pas
  écrit dans le dépôt : il est donné au moment de la connexion.
  Il retrouve le projet par son nom exact (une seule correspondance, projet actif), vérifie que
  `NEXT_PUBLIC_SUPABASE_URL` désigne ce même projet, et s'arrête si le schéma public n'est pas vide,
  si des comptes utilisateurs existent déjà ou si un autre déclencheur est branché sur les inscriptions.
  Les migrations s'appliquent en une seule transaction (tout ou rien), puis la RLS et les droits
  sont contrôlés. Nécessite `SUPABASE_ACCESS_TOKEN` (jeton personnel, défini dans les réglages de
  l'environnement et jamais dans un fichier, à révoquer après usage) et
  l'accès réseau à `api.supabase.com` ; derrière un proxy : `NODE_USE_ENV_PROXY=1`.
- **Supabase CLI** : `supabase link --project-ref <ref>` puis `supabase db push`.
- **SQL Editor** : exécuter les fichiers dans l'ordre.

Aucune migration n'exécute de `DROP`, `TRUNCATE` ou `DELETE` : elles sont uniquement additives
(la dernière remplace la fonction de génération des récurrences par une version compatible).

### Mettre à jour un projet existant (déjà en service)

Le script ci-dessus ne sert qu'à un projet **vide**. Sur le projet de production, appliquer seulement
les migrations **nouvelles**, une à une, dans le **SQL Editor**, AVANT de déployer le code qui en dépend :

1. Coller le contenu du fichier de migration, l'exécuter (une seule exécution : tout ou rien).
2. Vérifier avec les requêtes de contrôle en lecture seule données en tête de la PR / du rapport.
3. Seulement ensuite, fusionner dans `main` (Vercel redéploie la production).

`20261012090000_cocon_transferts_epargne.sql` : deux colonnes facultatives (NULL par défaut),
contraintes et index qui ne portent que sur elles, un contrôle du sens des transferts et la fonction
de génération mise à jour. Aucune ligne existante n'est modifiée ; les anciennes épargnes restent
valides (« compte de destination non précisé »).

Retour arrière, seulement si nécessaire (les données antérieures à la migration sont conservées ;
seuls les comptes de destination saisis depuis seraient perdus) :
```sql
drop trigger transactions_check_transfer on public.transactions;
drop trigger recurring_transactions_check_transfer on public.recurring_transactions;
drop function public.check_transfer_accounts();
alter table public.transactions drop column transfer_account_id;
alter table public.recurring_transactions drop column transfer_account_id;
-- puis ré-exécuter la définition de materialize_recurring_transactions de 20261005090300_cocon_functions.sql
```

### Module « Mes papiers » (administratif)

Deux migrations **additives**, à appliquer dans l'ordre, dans le SQL Editor, AVANT de fusionner le code :

1. `20261016090000_cocon_administratif.sql` — trois nouvelles tables, aucune table existante modifiée :
   - `documents` : la fiche d'un document (catégorie, type, titre, période, fichier). Le chemin du fichier
     commence toujours par l'identifiant de son propriétaire (contrainte) ; format et taille contrôlés.
   - `document_fields` : informations d'un document (employeur, salaire net, date d'échéance…),
     « proposée » ou « validée » par l'utilisateur ; une seule valeur typée par information.
   - `document_deadlines` : échéances d'un document (fin de contrat, date limite…).
   RLS sur les trois tables (lecture / création / modification / suppression limitées au propriétaire),
   rien pour les visiteurs, suppression d'un document → ses informations et échéances (cascade).
2. `20261016090100_cocon_administratif_stockage.sql` — espace de stockage `documents` **non public**,
   20 Mo au plus, PDF / JPEG / PNG / WebP ; chacun ne peut lire, déposer ou supprimer que dans son
   dossier (`<user_id>/…`) ; aucun fichier modifiable. Les fichiers ne s'ouvrent que par un lien
   temporaire signé (60 s). Échoue si un espace `documents` existe déjà (aucun mélange).

Si le code est déployé AVANT ces migrations, seul « Mes papiers » affiche « Tes documents n'ont pas pu
être chargés » ; le Budget n'est pas concerné (chargement séparé).

Vérification, en lecture seule :
```sql
select relname, relrowsecurity from pg_class where relname in ('documents', 'document_fields', 'document_deadlines');
select tablename, count(*) from pg_policies where tablename in ('documents', 'document_fields', 'document_deadlines') group by 1;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents';
select policyname from pg_policies where schemaname = 'storage' and policyname like 'documents (stockage)%';
```
Attendu : RLS activée sur les 3 tables (4 politiques chacune), espace `documents` avec `public = false`,
3 politiques de stockage.

Retour arrière, seulement si nécessaire (supprime les documents enregistrés ; les données du Budget
ne sont pas concernées). D'abord vider l'espace `documents` depuis le tableau de bord (Storage), puis :
```sql
drop policy "documents (stockage) : lecture de ses fichiers" on storage.objects;
drop policy "documents (stockage) : dépôt dans son dossier" on storage.objects;
drop policy "documents (stockage) : suppression de ses fichiers" on storage.objects;
delete from storage.buckets where id = 'documents';
drop table public.document_deadlines;
drop table public.document_fields;
drop table public.documents;
```

### Mes papiers — dossiers personnels

`20261017090000_cocon_dossiers.sql` — migration **additive**, à appliquer dans le SQL Editor AVANT de
fusionner le code (sans effet sur la version en service, qui n'utilise pas ces éléments) :
- nouvelle table `document_folders` (nom de 1 à 60 caractères, unique par utilisateur sans tenir compte
  des majuscules ni des espaces autour, icône) ; RLS : 4 politiques limitées au propriétaire, rien pour
  les visiteurs ;
- nouvelle colonne **facultative** `documents.folder_id` : vide pour tous les documents existants
  (aucun n'est déplacé ni modifié). Clé étrangère composite `(folder_id, user_id)` : un document ne peut
  être rangé que dans un dossier du même utilisateur. Supprimer un dossier **ne supprime jamais ses
  documents** : `on delete set null (folder_id)` vide seulement ce champ.

Le code de cette version fonctionne AUSSI avant la migration (aperçu Vercel branché sur la production,
par exemple) : « Mes papiers » se charge et les documents s'enregistrent comme avant ; seuls les
dossiers sont masqués, jusqu'à l'application de la migration.

Le scan des photos (détourage, redressement, rendu « document ») se fait entièrement sur l'appareil :
il ne demande aucune migration et n'envoie rien à un service externe.

Vérification, en lecture seule, à lancer AVANT puis APRÈS (une seule ligne de résultat) :
```sql
select
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'document_folders' and c.relrowsecurity) as dossiers_rls,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'document_folders') as dossiers_politiques,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'folder_id') as colonne_dossier,
  (select count(*) from public.documents) as documents;
```
Attendu : avant `0 · 0 · 0 · N`, après `1 · 4 · 1 · N` — le même nombre `N` de documents.

Retour arrière, seulement si nécessaire (les documents et leurs fichiers sont conservés ; seuls les
dossiers et le rangement des documents dans ces dossiers sont perdus) :
```sql
alter table public.documents drop constraint documents_folder_fkey;
drop index public.documents_user_folder_idx;
alter table public.documents drop column folder_id;
drop table public.document_folders;
```

> Suppression d'un compte utilisateur : la cascade efface ses fiches, mais les fichiers du Storage
> doivent être supprimés via l'API Storage (dossier `<user_id>/`) — à prévoir avant toute suppression de compte.

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
