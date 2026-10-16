/**
 * Classement proposé à partir du NOM du fichier uniquement (aucune IA, aucun service externe).
 * Cocon propose, l'utilisateur confirme : le résultat est toujours « à vérifier ».
 */
import type { DocumentCategory } from "@/types/documents";
import { formatMonth } from "../dates";
import { normalizeText } from "../text";
import { typeInfo } from "./catalog";

export interface Classification {
  category: DocumentCategory;
  type: string;
  periodYear?: number;
  periodMonth?: number;
  /** Titre proposé (« Fiche de paie · septembre 2026 »). */
  title: string;
}

/** Règles dans l'ordre : la première qui correspond l'emporte (les plus précises d'abord). */
const RULES: { type: string; pattern: RegExp }[] = [
  { type: "fiche_paie", pattern: /\b(bulletins? (de )?(salaire|paie|paye)|fiches? (de )?(paie|paye|salaire)|payslip|paie|paye)\b/ },
  { type: "avenant", pattern: /\bavenant\b/ },
  { type: "contrat_travail", pattern: /\b(contrat (de )?travail|cdi|cdd|contrat d embauche)\b/ },
  { type: "attestation_employeur", pattern: /\b(attestation (employeur|de travail|france travail|pole emploi)|certificat de travail|solde de tout compte)\b/ },
  { type: "avis_imposition", pattern: /\b(avis (d )?(impot|impots|imposition)|avis de taxe)\b/ },
  { type: "declaration", pattern: /\b(declaration (de |des )?(revenus|impots?)|2042)\b/ },
  { type: "prelevement_source", pattern: /\b(prelevement a la source|taux de prelevement)\b/ },
  { type: "justificatif_fiscal", pattern: /\b(recu fiscal|justificatif (fiscal|d impot|impots?))\b/ },
  { type: "autre_impots", pattern: /\b(impots?|fiscal|fiscale|dgfip|taxe fonciere|taxe d habitation)\b/ },
  { type: "mutuelle", pattern: /\b(mutuelle|tiers payant|complementaire sante)\b/ },
  { type: "ordonnance", pattern: /\bordonnances?\b/ },
  { type: "remboursement", pattern: /\b(remboursements?|decomptes?)\b/ },
  { type: "document_medical", pattern: /\b(compte rendu|resultats? (d )?analyses?|bilan sanguin|radio|irm|certificat medical)\b/ },
  { type: "facture_sante", pattern: /\b(facture.*(medecin|pharmacie|dentiste|opticien|kine|hopital|clinique)|(medecin|pharmacie|dentiste|opticien|kine).*facture)\b/ },
  { type: "autre_sante", pattern: /\b(sante|medical|medicale|ameli|cpam|securite sociale)\b/ },
  { type: "assurance_habitation", pattern: /\b(assurance.*(habitation|logement|maison|appartement)|multirisque habitation|mrh)\b/ },
  { type: "assurance_auto", pattern: /\b(assurance.*(auto|automobile|voiture|vehicule|moto)|carte verte)\b/ },
  { type: "responsabilite_civile", pattern: /\bresponsabilite civile\b/ },
  { type: "prevoyance", pattern: /\bprevoyance\b/ },
  { type: "autre_assurance", pattern: /\b(assurances?|assureur|attestation d assurance)\b/ },
];

const MONTH_WORDS: [RegExp, number][] = [
  [/\bjanv(ier)?\b/, 1],
  [/\bfevr?(ier)?\b/, 2],
  [/\bmars\b/, 3],
  [/\bavr(il)?\b/, 4],
  [/\bmai\b/, 5],
  [/\bjuin\b/, 6],
  [/\bjuil(let)?\b/, 7],
  [/\baout\b/, 8],
  [/\bsept(embre)?\b/, 9],
  [/\boct(obre)?\b/, 10],
  [/\bnov(embre)?\b/, 11],
  [/\bdec(embre)?\b/, 12],
];

/** Nom de fichier → texte comparable : sans extension, accents, majuscules ni séparateurs. */
export function normalizeFileName(fileName: string): string {
  return normalizeText(fileName.replace(/\.[a-z0-9]{2,5}$/i, ""))
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .trim();
}

/** Période lisible dans un nom : « septembre 2026 », « 2026 09 », « 09 2026 », « 202609 ». */
export function periodFromName(name: string, today: string): { year?: number; month?: number } {
  const maxYear = Number(today.slice(0, 4)) + 1;
  const plausible = (y: number) => y >= 1990 && y <= maxYear;
  const compact = name.match(/\b((?:19|20)\d{2})(0[1-9]|1[0-2])\b/);
  if (compact && plausible(Number(compact[1]))) return { year: Number(compact[1]), month: Number(compact[2]) };
  const ym = name.match(/\b((?:19|20)\d{2}) (0?[1-9]|1[0-2])\b/);
  if (ym && plausible(Number(ym[1]))) return { year: Number(ym[1]), month: Number(ym[2]) };
  const my = name.match(/\b(0?[1-9]|1[0-2]) ((?:19|20)\d{2})\b/);
  if (my && plausible(Number(my[2]))) return { year: Number(my[2]), month: Number(my[1]) };
  const years = [...name.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1])).filter(plausible);
  const year = years.at(-1);
  const month = MONTH_WORDS.find(([pattern]) => pattern.test(name))?.[1];
  return { year, month: year !== undefined ? month : undefined };
}

/**
 * Proposition de classement d'après le nom du fichier, ou `null` si rien n'est reconnaissable
 * (« IMG_1234.jpg », « scan.pdf ») : aucune catégorie n'est alors inventée.
 */
export function classifyFileName(fileName: string, today: string): Classification | null {
  const name = normalizeFileName(fileName);
  const rule = RULES.find((r) => r.pattern.test(name));
  if (!rule) return null;
  const type = typeInfo(rule.type);
  const { year, month } = periodFromName(name, today);
  const periodMonth = type.period === "month" ? month : undefined;
  const periodYear = type.period ? year : undefined;
  const period = periodYear && periodMonth ? formatMonth(`${periodYear}-${String(periodMonth).padStart(2, "0")}`).toLowerCase() : periodYear ? String(periodYear) : "";
  return {
    category: type.category,
    type: type.id,
    periodYear,
    periodMonth,
    title: period ? `${type.label} · ${period}` : type.label,
  };
}

/** Titre lisible tiré d'un nom de fichier (« bulletin_salaire-sept.pdf » → « Bulletin salaire sept »). */
export function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  const title = base.charAt(0).toUpperCase() + base.slice(1);
  return title.slice(0, 120) || "Document";
}
