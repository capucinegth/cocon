import type { Tone } from "@/types/finance";

/**
 * Correspondance entre une famille de couleur et ses classes Tailwind.
 * Les classes sont écrites en entier pour que Tailwind les détecte.
 */
export const toneStyles: Record<
  Tone,
  {
    /** Fond de carte doux. */
    surface: string;
    /** Fond des pastilles (icônes, emojis). */
    badge: string;
    /** Remplissage des barres de progression. */
    fill: string;
    /** Rail des barres de progression. */
    track: string;
    /** Texte d'accent lisible sur fond clair. */
    text: string;
    /** Trait SVG (anneaux de progression). */
    stroke: string;
    trackStroke: string;
  }
> = {
  blush: {
    surface: "bg-blush-50",
    badge: "bg-blush-100",
    fill: "bg-blush-300",
    track: "bg-blush-50",
    text: "text-blush-700",
    stroke: "stroke-blush-300",
    trackStroke: "stroke-blush-50",
  },
  lilac: {
    surface: "bg-lilac-50",
    badge: "bg-lilac-100",
    fill: "bg-lilac-300",
    track: "bg-lilac-50",
    text: "text-lilac-700",
    stroke: "stroke-lilac-300",
    trackStroke: "stroke-lilac-50",
  },
  sage: {
    surface: "bg-sage-50",
    badge: "bg-sage-100",
    fill: "bg-sage-300",
    track: "bg-sage-50",
    text: "text-sage-700",
    stroke: "stroke-sage-300",
    trackStroke: "stroke-sage-50",
  },
  peach: {
    surface: "bg-peach-50",
    badge: "bg-peach-100",
    fill: "bg-peach-300",
    track: "bg-peach-50",
    text: "text-peach-700",
    stroke: "stroke-peach-300",
    trackStroke: "stroke-peach-50",
  },
};
