# Cocon — budget mensuel (V3)

Application web personnelle de gestion de budget, pensée mobile d'abord.
Question centrale : **« Combien puis-je réellement dépenser aujourd'hui sans mettre mon budget en danger ? »**

La V3 transforme le prototype en vraie application : comptes utilisateurs, données enregistrées
dans Supabase (PostgreSQL + Auth + RLS), retrouvées après rechargement et sur tous les appareils.
L'interface de la V2 est conservée.

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
- **Opérations** : ajout, modification, suppression (avec annulation), note facultative, filtres,
  recherche, opérations datées dans le futur (« À venir », y compris les mois suivants), récurrences
  hebdomadaires / mensuelles générées automatiquement à échéance — description, montant, fréquence,
  prochaine échéance, catégorie, compte modifiables ; pause et reprise sans rattrapage —, export CSV.
- **Budget par mois** : montant par catégorie, revenus et épargne prévus, reprise automatique
  du mois précédent, préparation du mois suivant, catégories de dépenses et de revenus personnalisées
  (archivage sans perte d'historique, restauration).
- **Mes comptes** : nom, solde de départ, actif / désactivé (jamais supprimé ; ses récurrences
  sont mises en pause), ordre d'affichage ; solde calculé par compte, solde total hors épargne
  et patrimoine total.
- **Épargne = transfert** : un versement passe d'un compte hors épargne vers un compte d'épargne
  (Livret A) ; le patrimoine ne change pas et le disponible ne le déduit qu'une fois.
- **Objectifs** : création, versement, progression calculée en base, modification, suppression.
- **Accueil / Statistiques** : disponible réel, disponible par jour, état du budget, calendrier,
  statistiques de n'importe quel mois, solde total hors épargne, tendances — tout est recalculé
  automatiquement à chaque saisie.
- **Paramètres** : prénom et mode discret enregistrés dans le profil (retrouvés sur un autre appareil),
  comptes, catégories, budget du mois, export CSV. Aucun réglage factice.
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

- Calculs centralisés et testés : `src/lib/budget.ts`, `accounts.ts`, `timeline.ts`, `recurrence.ts`, `goals.ts`.
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
