"use client";

import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

interface TutorialStep {
  emoji: string;
  title: string;
  text: string;
  /** Où trouver la fonction dans l'application. */
  where?: string;
}

/** Les bases de Cocon, dans l'ordre où on s'en sert la première fois. */
export const tutorialSteps: TutorialStep[] = [
  {
    emoji: "🌱",
    title: "Bienvenue dans Cocon",
    text: "Cocon répond à une question : combien puis-je encore dépenser ce mois-ci, sans me mettre en difficulté ? Voici l'essentiel en quelques étapes.",
  },
  {
    emoji: "🏦",
    title: "Renseigne tes comptes",
    text: "Indique le solde de chaque compte tel que ta banque l'affiche. Tu pourras l'actualiser à tout moment : Cocon recale le compte sans toucher à tes opérations.",
    where: "Paramètres → Mes comptes",
  },
  {
    emoji: "💶",
    title: "Tu peux encore dépenser",
    text: "Le grand chiffre de l'accueil : l'argent sur tes comptes (hors épargne), moins ce qui partira encore d'ici la fin du mois. Un salaire compte dès qu'il est arrivé.",
    where: "Accueil",
  },
  {
    emoji: "➕",
    title: "Ajoute tes dépenses",
    text: "Montant, catégorie, et c'est fait. Tu peux aussi scanner un ticket de caisse : la photo est lue sur ton téléphone, elle n'est envoyée nulle part.",
    where: "Bouton « Ajouter »",
  },
  {
    emoji: "🔁",
    title: "Tes charges fixes",
    text: "Loyer, abonnements, virement d'épargne… avec leur jour de prélèvement. Elles sont déduites d'office, et tu vois ce qui part de chaque compte.",
    where: "Budget → Charge fixe",
  },
  {
    emoji: "📊",
    title: "Ton budget du mois",
    text: "Un montant par catégorie, tes revenus et ton épargne prévus. « Reste dans ton budget » te dit où tu en es par rapport à ce que tu avais prévu.",
    where: "Budget",
  },
  {
    emoji: "🎯",
    title: "Objectifs et papiers",
    text: "Mets de l'argent de côté pour un projet et suis ta progression. Range aussi tes documents administratifs, photographiés depuis ton téléphone.",
    where: "Objectifs · Papiers",
  },
];

function TutorialSteps() {
  const { profile, updateProfile } = useBudget();
  const { closeSheet } = useUI();
  const [index, setIndex] = useState(0);
  const step = tutorialSteps[index];
  const isLast = index === tutorialSteps.length - 1;

  function finish() {
    closeSheet();
    markTutorialSeen(profile?.preferences.tutorialSeen, updateProfile);
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center px-6 pb-6 pt-2 text-center" aria-live="polite">
        <span aria-hidden className="grid size-20 place-items-center rounded-3xl bg-linear-to-br from-blush-100 to-lilac-50 text-4xl">
          {step.emoji}
        </span>
        <p className="mt-5 text-[13px] font-semibold text-muted">
          Étape {index + 1} sur {tutorialSteps.length}
        </p>
        <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{step.title}</h3>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
        {step.where && (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-semibold text-blush-700">
            <MapPin size={14} aria-hidden />
            {step.where}
          </p>
        )}
        <ol className="mt-6 flex gap-2" aria-label="Progression">
          {tutorialSteps.map((s, i) => (
            <li key={s.title}>
              <span
                aria-hidden
                className={cn("block h-2 rounded-full transition-all duration-300", i === index ? "w-6 bg-blush-500" : "w-2 bg-ink/15")}
              />
              <span className="sr-only">{i === index ? `${s.title} (étape en cours)` : s.title}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="sticky bottom-0 flex gap-3 bg-surface/95 px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 backdrop-blur">
        {index === 0 ? (
          <Button variant="white" size="lg" onClick={finish} className="flex-1">
            Passer
          </Button>
        ) : (
          <Button variant="white" size="lg" onClick={() => setIndex((i) => i - 1)} className="flex-1">
            <ChevronLeft size={18} aria-hidden />
            Précédent
          </Button>
        )}
        {isLast ? (
          <Button size="lg" onClick={finish} className="flex-1">
            C&apos;est parti
          </Button>
        ) : (
          <Button size="lg" onClick={() => setIndex((i) => i + 1)} className="flex-1">
            Suivant
            <ChevronRight size={18} aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Retenu dans le profil (donc sur tous les appareils) : le tuto ne s'ouvre plus tout seul. */
function markTutorialSeen(seen: boolean | undefined, updateProfile: ReturnType<typeof useBudget>["updateProfile"]) {
  if (seen) return;
  // Sans réseau, il se rouvrira simplement à la prochaine visite : rien à signaler.
  updateProfile({ preferences: { tutorialSeen: true } }).catch(() => {});
}

/** Tuto de découverte : ouvert une fois à l'arrivée d'un nouveau compte, puis depuis Paramètres → Aide. */
export function TutorialSheet() {
  const { profile, updateProfile } = useBudget();
  const { sheet, isSheetOpen, sheetSession, closeSheet } = useUI();
  const open = isSheetOpen && sheet?.type === "tutorial";

  return (
    <Sheet
      open={open}
      onClose={() => {
        closeSheet();
        markTutorialSeen(profile?.preferences.tutorialSeen, updateProfile);
      }}
      title="Découvrir Cocon"
    >
      {sheet?.type === "tutorial" && <TutorialSteps key={sheetSession} />}
    </Sheet>
  );
}
