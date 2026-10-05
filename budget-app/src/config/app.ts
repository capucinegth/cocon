export const appConfig = {
  name: "Cocon",
  tagline: "Ton budget, en douceur",
  version: "0.2",
  /**
   * Date « du jour » figée pour la démo : tous les écrans restent cohérents
   * (18 jours restants en septembre 2026). À remplacer par la vraie date
   * quand les données seront réelles.
   */
  demoToday: "2026-09-13",
  /** À partir de ce montant, une dépense apparaît dans le calendrier du mois. */
  largeExpenseThreshold: 30,
  /**
   * État du budget : on compare le disponible par jour au budget quotidien moyen.
   * ≥ comfortable → « Confortable », ≥ attention → « Attention », sinon « Budget serré ».
   */
  healthThresholds: { comfortable: 0.95, attention: 0.7 },
} as const;
