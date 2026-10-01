# Cocon — budget mensuel (prototype)

Application web personnelle de gestion de budget, pensée mobile d'abord.
Question centrale : **« Combien ai-je réellement à disposition, et combien puis-je dépenser sans dépasser mon budget ? »**

> Étape actuelle : **prototype d'interface uniquement**. Données fictives, rien n'est enregistré,
> aucune banque n'est connectée. L'ajout d'une dépense fonctionne en mémoire (perdu au rechargement).

## Lancer le projet

```bash
cd budget-app
npm install
npm run dev        # http://localhost:3000
```

Autres commandes : `npm run build`, `npm run lint`, `npm run typecheck`.

Stack : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, icônes Lucide.

## Écrans

| Route           | Écran                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `/`             | Accueil : « Il te reste », chiffres clés, dépenses, à venir, objectif |
| `/budget`       | Revenus, charges fixes, dépenses variables, épargne, reste disponible |
| `/transactions` | Liste par jour, recherche, filtres, opérations prévues                |
| `/objectifs`    | Objectifs d'épargne avec anneaux de progression                       |
| `/statistiques` | « Ce mois-ci » (catégories, comparaison) / « Tendances » (6 mois)     |
| `/parametres`   | Réglages (connexions et export marqués « Bientôt »)                   |

Le bouton **+ Ajouter** (flottant sur mobile, dans la barre latérale sur ordinateur) ouvre l'ajout rapide.

## Structure

```
src/
  app/                 Routes Next.js (fines : elles affichent un écran)
  features/<écran>/    Composants propres à chaque écran
  components/ui/       Design system : Card, Button, ProgressBar, Sheet, StatusPill…
  components/layout/   Coque : barre latérale, barre du bas, bouton flottant, en-têtes
  components/charts/   Graphiques SVG légers (colonnes, courbe, barres)
  config/              Catégories, comptes, navigation, couleurs par famille, nom de l'app
  data/                Données de démo + point d'entrée unique getInitialBudgetData()
  lib/                 Formatage (€, dates en français), calculs d'affichage
  store/               État client (données du mois, feuille d'ajout, notifications)
  types/               Modèle de données (proche des futures tables)
```

## Personnaliser

- **Couleurs, arrondis, ombres, animations** : `src/app/globals.css` (bloc `@theme`).
- **Familles de couleur → classes** (rose, lilas, sauge, pêche) : `src/config/tones.ts`.
- **Catégories** (libellé, emoji, couleur, groupe) : `src/config/categories.ts`.
- **Navigation** (ordre, libellés, icônes) : `src/config/navigation.ts`.
- **Nom, slogan, date de démo** : `src/config/app.ts`.
- **Chiffres de démo** : `src/data/demo-data.ts` (les totaux sont recalculés automatiquement).

## Préparé pour la suite

- `src/data/index.ts` est le seul endroit qui fournit les données : on y branchera Supabase
  sans toucher aux écrans.
- `src/store/budget-store.tsx` expose `addTransaction` / `resetDemo` : ces actions deviendront
  des écritures en base.
- Les types de `src/types/finance.ts` décrivent déjà transactions, prélèvements prévus,
  budget par catégorie et objectifs.
