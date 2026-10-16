import {
  ArrowLeftRight,
  ChartColumn,
  House,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Libellé court pour la barre mobile. */
  shortLabel?: string;
  icon: LucideIcon;
}

/** Navigation principale : barre du bas (mobile) et barre latérale (desktop). */
export const mainNav: NavItem[] = [
  { href: "/", label: "Accueil", icon: House },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/transactions", label: "Dépenses et revenus", shortLabel: "Dépenses", icon: ArrowLeftRight },
  { href: "/objectifs", label: "Objectifs", icon: Target },
  { href: "/statistiques", label: "Statistiques", shortLabel: "Stats", icon: ChartColumn },
];

export const settingsNav: NavItem = { href: "/parametres", label: "Paramètres", icon: Settings };

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
