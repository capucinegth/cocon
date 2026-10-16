# Cocon — budget mensuel (V4)

Application web personnelle de gestion de budget, pensée mobile d'abord.
Question centrale : **« Combien puis-je réellement dépenser aujourd'hui sans mettre mon budget en danger ? »**

La V3 transforme le prototype en vraie application : comptes utilisateurs, données enregistrées
dans Supabase (PostgreSQL + Auth + RLS), retrouvées après rechargement et sur tous les appareils.
La V4 simplifie l'interface sans toucher aux calculs : l'accueil répond d'abord à
**« Combien puis-je encore dépenser ? »**, le vocabulaire est unifié et l'ajout d'une dépense tient en
trois gestes (montant → catégorie suggérée → Ajouter).

## Deux modes, jamais mélangés

| Mode | Quand | Données |
| --- | --- | --- |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` + clé publique définies | Vraies données du compte connecté, protégées par la RLS |
| **Démo** | Aucune configuration (ou `NEXT_PUBLIC_COCON_DATA_SOURCE=demo`) | Données fictives en mémoire, rien n'est envoyé ni enregistré |

En mode démo, l'interface l'indique (barre latérale, Paramètres, page de connexion).

## Lancer le projet

```bash
cd budget-app
npm install
npm run dev        # http://localhost:3000 (mode démo sans configuration)
```

Pour le mode Supabase : copier `.env.example` en `.env.local` et renseigner l'URL et la **clé publique**
du projet Supabase de Cocon. Mise en place complète et points à valider : [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Fonctionnalités

- **Compte** : inscription (prénom facultatif), connexion, déconnexion, mot de passe oublié,
  modification du mot de passe, session persistante,
  pages protégées, session expirée → retour à la connexion avec un message clair, erreurs en français.
- **Accueil (toujours le mois en cours)** : « Tu peux encore dépenser » (réponse du budget du mois),
  montant par jour, état du budget expliqué en une phrase (jamais de phrase rassurante si les données ne
  la justifient pas) ; **garde de trésorerie** : si l'argent des comptes hors épargne, après les opérations
  à venir du mois, passerait sous zéro ou ne couvrirait pas ce que le budget laisse à dépenser, une alerte
  s'affiche — le chiffre du budget n'est jamais remplacé (`src/lib/treasury.ts`) ; « Prochainement »
  (4 prochaines opérations) ; « Mon argent » (sur tes comptes · épargne · tout ton argent) ; dernières dépenses.
  Le calcul ligne à ligne est dans Budget (« Voir le calcul »).
- **Ajout rapide** : montant, catégorie **suggérée** d'après tes habitudes (les 4 plus utilisées, toutes
  accessibles), Ajouter. Description, note, date, répétition et compte sont dans « Plus d'options »
  (résumé visible). Un marchand déjà saisi reprend sa catégorie et son compte, sans jamais écraser un choix
  explicite (`src/lib/suggestions.ts` : local, déterministe, aucun service externe).
- **Dépenses et revenus** : ajout, modification, suppression (avec annulation), note facultative, filtres,
  recherche, reçu / dépensé du mois (l'épargne à part), calendrier du mois, opérations datées dans le futur
  (« À venir », y compris les mois suivants), opérations qui se répètent
  hebdomadaires / mensuelles générées automatiquement à échéance — description, montant, fréquence,
  prochaine échéance, catégorie, compte modifiables ; pause et reprise sans rattrapage —, export CSV.
- **Scan de ticket de caisse** : dans « Ajouter une dépense », « Scanner un ticket » ouvre l'appareil photo ;
  le montant (TOTAL / NET À PAYER), le magasin et la date sont lus **sur l'appareil** (Tesseract,
  fichiers servis par Cocon depuis `/ocr`, copiés depuis `node_modules` à chaque `dev` / `build`) :
  la photo n'est envoyée nulle part ni enregistrée. Le formulaire est pré-rempli, à vérifier avant d'ajouter.
- **Charges fixes** (Budget → Prélèvements et revenus réguliers → « Charge fixe ») : nom, montant, jour du
  prélèvement (1–31, « 31 » = dernier jour des mois plus courts), catégorie, compte. Aucune opération
  n'est créée à l'enregistrement. Premier prélèvement : aujourd'hui si c'est le jour du prélèvement,
  ce mois-ci s'il est encore à venir ; s'il est déjà passé, il est considéré comme déjà dans le solde réel
  et n'est **pas** déduit, le premier prélèvement compté est le mois suivant. Ensuite, chaque prélèvement
  est ajouté automatiquement à sa date.
- **Budget par mois** : montant par catégorie, revenus et épargne prévus, reprise automatique
  du mois précédent, préparation du mois suivant, catégories de dépenses et de revenus personnalisées
  (archivage sans perte d'historique, restauration).
- **Mes comptes** : création (compte courant, joint, espèces, épargne ou autre, avec son solde de départ ;
  un compte d'épargne ne reçoit que des versements d'épargne), nom, solde de départ, actif / désactivé (jamais supprimé ; ses récurrences
  sont mises en pause), ordre d'affichage ; solde calculé par compte, « Sur tes comptes » (hors épargne)
  et « Tout ton argent » (comptes + épargne).
- **Épargne = transfert** : un versement passe d'un compte hors épargne vers un compte d'épargne
  (Livret A) ; « tout ton argent » ne change pas et ce que tu peux dépenser ne le déduit qu'une fois.
- **Objectifs** : création, versement, progression calculée en base, modification, suppression. Le total
  « mis de côté pour tes objectifs » suit leurs versements ; s'il diffère de l'épargne sur les comptes,
  une note l'explique (rien n'est recalculé).
- **Mes papiers (Administratif)** : documents administratifs rangés en 4 catégories (Professionnel,
  Santé, Impôts, Assurances). Ajout depuis le téléphone : **prendre une photo** (appareil photo direct),
  choisir une photo ou un fichier ; plusieurs pages photographiées (ajout, reprise, ordre, suppression)
  deviennent **un seul PDF**, assemblé sur l'appareil, photos redressées et réduites sans perdre en
  lisibilité. Classement **proposé** d'après le nom du fichier (aucune IA, aucun service externe),
  toujours modifiable avant d'enregistrer. Fiche : consulter / télécharger par **lien temporaire
  (60 s)**, informations simples et typées (« à vérifier » ou « validée »), échéances (7, 30, 60 jours,
  plus tard), modification, suppression (fichier puis fiche). Recherche locale sans accents (titre, type,
  catégorie, année, informations validées) et filtres. **Rien n'est relié automatiquement au Budget.**
  Stockage privé Supabase, RLS par utilisateur ; module isolé (`services/documents/*`,
  `store/documents-store.tsx`, `lib/admin/*`), chargé seulement dans « Mes papiers ».
- **Statistiques** : n'importe quel mois, sur tes comptes jour par jour, tendances — tout est recalculé
  automatiquement à chaque saisie.
- **Paramètres** : Moi (prénom, mot de passe, déconnexion), Mes comptes, Catégories, Affichage (mode discret,
  enregistré dans le profil), Mes données (export CSV), À propos. Les réglages du budget sont dans Budget.
  Aucun réglage factice.
- **Responsive** : mobile d'abord ; tablette en deux colonnes ; grand écran avec barre latérale et
  colonnes côte à côte. Vérifié automatiquement à 320, 375, 390, 430, 768, 1024, 1280 et 1440 px
  (aucun débordement, aucun élément hors écran, pages et feuilles).
- **États** : chargement, erreur avec « Réessayer », compte neuf (« Bienvenue dans Cocon »),
  enregistrement impossible (message clair, saisie conservée).
- **Application installable (PWA)** : manifeste, icônes, page hors connexion. Le service worker
  ne met en cache que les fichiers de l'application, jamais de données.
- **Préparé dans le code, non affiché dans l'application** : rappels (`src/services/notifications.ts`),
  connexion bancaire via agrégateur DSP2 (`src/services/bank-import.ts`) — Cocon ne demande
  et ne stocke jamais d'identifiants bancaires.

## Architecture

```
UI (features/, components/)
  → store (store/budget-store.tsx : actions async, états chargement / erreur)
    → dépôt (services/repository.ts)
        ├─ services/demo-repository.ts      données fictives en mémoire
        └─ services/supabase-repository.ts  Supabase (mappers.ts : centimes ⇄ euros)
             → PostgreSQL : tables + RLS + fonctions (supabase/migrations/)
```

- Calculs centralisés et testés : `src/lib/budget.ts`, `accounts.ts`, `timeline.ts`, `recurrence.ts`, `goals.ts`,
  `receipt.ts` (lecture du texte d'un ticket), `treasury.ts` (mon argent, garde de trésorerie),
  `suggestions.ts` (catégories et marchands déjà vus).
- Dates en heure de Paris (`src/lib/paris-time.ts`), montants en centimes entiers en base.
- Session : `@supabase/ssr` (cookies), rafraîchie et vérifiée par `src/proxy.ts`.
- Une modification est enregistrée **puis** affichée : en cas d'échec, rien ne change à l'écran.

```
src/
  app/(app)/            Pages de l'application (protégées)
  app/(auth)/           Connexion, inscription
  app/auth/callback/    Retour du lien de confirmation par e-mail
  features/             Écrans et feuilles (ajout, modification…)
  services/             Dépôts de données, notifications, import bancaire (préparé)
  store/                Session, données, état d'interface ; budget-state.ts = transformations pures
  lib/                  Calculs, dates, formatage, Supabase (clients, configuration)
supabase/
  migrations/           Schéma, inscription, RLS, fonctions — versionnés
  tests/support/        Shim LOCAL pour tester les migrations sur un PostgreSQL nu (jamais sur Supabase)
tests/
  unit/                 Calculs, récurrences, fuseau, conversions, sécurité (Vitest)
  db/                   Migrations + RLS sur un vrai PostgreSQL, plusieurs utilisateurs
  integration/          Dépôt Supabase contre une pile Supabase locale
  e2e/                  Parcours complets dans le navigateur (Playwright), démo et Supabase
```

## Tests

```bash
npm run typecheck && npm run lint
npm test                      # tests unitaires
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run test:db   # PostgreSQL local vierge (15+)
E2E_SUPABASE_URL=http://127.0.0.1:54321 E2E_SUPABASE_ANON_KEY=… npm run test:integration
npm run test:e2e:demo
E2E_SUPABASE_URL=… E2E_SUPABASE_ANON_KEY=… npm run test:e2e:supabase
```

Les tests de base, d'intégration et de bout en bout **refusent** toute adresse qui n'est pas locale :
ils ne créent jamais de compte de test sur un vrai projet. Une pile locale s'obtient avec
`supabase start` (Supabase CLI) ; les migrations du dossier `supabase/migrations` y sont appliquées.

## Données de démonstration

Au 13 septembre 2026 (date figée dans `src/config/app.ts`) :

```
revenus 2 150 € − charges fixes 840 € − dépenses du quotidien 366,80 € − épargne 300 €
= 643,20 € disponibles  →  ≈ 35,73 € / jour pour 18 jours
```

## Accessibilité

- Audit axe-core (WCAG 2.1 AA) automatisé sur toutes les pages, en démo et avec un vrai compte.
- Texte secondaire `#74666B` (≥ 4,8:1), focus visible, cibles tactiles ≥ 40 px, messages d'erreur
  annoncés, animations désactivées si « réduire les animations » est activé.
