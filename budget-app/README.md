# Cocon — budget mensuel (prototype V2)

Application web personnelle de gestion de budget, pensée mobile d'abord.
Question centrale : **« Combien puis-je réellement dépenser aujourd'hui sans mettre mon budget en danger ? »**

> Étape actuelle : **prototype d'interface**. Données fictives, rien n'est enregistré,
> aucune banque n'est connectée. Les ajouts (opérations, catégories, objectifs) fonctionnent
> en mémoire et disparaissent au rechargement de la page.

## Lancer le projet

```bash
cd budget-app
npm install
npm run dev        # http://localhost:3000
```

Autres commandes : `npm run build`, `npm run lint`, `npm run typecheck`.

Stack : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, icônes Lucide.

## Écrans

| Route           | Écran                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| `/`             | Accueil : disponible réel + par jour + état du budget, navigation entre les mois, repères, calcul « Ce qu'il te reste », à venir, transactions récentes, calendrier du mois |
| `/budget`       | Budget du mois : chiffres clés, répartition des revenus (anneau), catégories avec prévu / dépensé / reste, ajout de catégorie |
| `/transactions` | Recherche, filtres type / mois / catégorie, liste par jour, opérations prévues, détail et suppression (avec annulation) |
| `/objectifs`    | Mes objectifs : progression, rythme, date estimée, verser, créer un objectif                   |
| `/statistiques` | Ce mois-ci (dépenses jour par jour, répartition, comparaison) · Solde · Tendances (6 mois)     |
| `/parametres`   | Compte, Préférences (mode discret fonctionnel), Catégories, Budget, Notifications, Sécurité, À propos |

Le bouton **+ Ajouter** (flottant sur mobile, dans la barre latérale sur ordinateur) ouvre l'ajout
rapide : dépense, revenu ou épargne (vers un objectif), avec description, catégorie, date, récurrence et compte.

## Données de démonstration

Au 13 septembre 2026 (date figée dans `src/config/app.ts`), tout est cohérent entre les écrans :

```
revenus 2 150 € − charges fixes 840 € − dépenses du quotidien 366,80 € − épargne 300 €
= 643,20 € disponibles  →  ≈ 35,73 € / jour pour 18 jours
```

Août 2026 est complet : il sert à la navigation entre les mois, au filtre par mois et à la
comparaison « même date, mois précédent ». Le détail est commenté dans `src/data/demo-data.ts`.

## Structure

```
src/
  app/                  Routes Next.js (fines : elles affichent un écran)
  features/<écran>/     Composants propres à chaque écran (+ feuilles d'ajout)
  components/ui/        Design system : Card, Button, Money, Sheet, SegmentedControl, formulaires…
  components/finance/   Composants métier partagés (ligne d'opération, calcul « Ce qu'il te reste »)
  components/calendar/  Calendrier du mois
  components/charts/    Graphiques SVG légers (colonnes, courbe, anneau, barres)
  components/layout/    Coque : barre latérale, barre du bas, bouton flottant, en-têtes, toasts
  config/               Catégories par défaut, comptes, navigation, couleurs, réglages de l'app
  data/                 Données de démo + point d'entrée unique getInitialBudgetData()
  lib/                  Calculs (budget.ts, timeline.ts, goals.ts), formatage français, texte
  store/                État client : données (budget-store) et interface (ui-store)
  types/                Modèle de données (proche des futures tables)
```

## Personnaliser

- **Couleurs, contrastes, arrondis, ombres, animations** : `src/app/globals.css` (bloc `@theme`).
- **Familles de couleur → classes** (rose, lilas, sauge, pêche) : `src/config/tones.ts`.
- **Catégories par défaut** : `src/config/categories.ts`.
- **Navigation** : `src/config/navigation.ts`.
- **Nom, date de démo, seuils (état du budget, dépense importante)** : `src/config/app.ts`.

## Accessibilité

- Texte secondaire `#74666B` (≥ 4,8:1 sur tous les fonds clairs) ; le gris d'origine `#8A7C81`
  reste disponible pour le décor (`muted-soft`).
- Couleurs des graphiques validées pour le daltonisme ; formes distinctes dans le calendrier.
- Focus visible, cibles tactiles ≥ 40 px, tableaux de données cachés pour les lecteurs d'écran,
  animations désactivées si « réduire les animations » est activé.

## Préparé pour la suite (non implémenté)

Supabase, authentification, synchronisation bancaire, notifications réelles, PWA :
`src/data/index.ts` est le seul point d'entrée des données et le store expose déjà les actions
(`addTransaction`, `removeTransaction`, `addCategory`, `addGoal`…) qui deviendront des écritures en base.
