"use client";

import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Coins,
  Download,
  EyeOff,
  Fingerprint,
  Globe,
  Info,
  Landmark,
  Lock,
  Moon,
  Palette,
  Plus,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Toggle } from "@/components/ui/toggle";
import { accounts } from "@/config/accounts";
import { appConfig } from "@/config/app";
import { isExpenseCategory } from "@/config/categories";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

function SoonBadge() {
  return <span className="shrink-0 rounded-full bg-lilac-50 px-2.5 py-1 text-[12px] font-semibold text-lilac-700">Bientôt</span>;
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  hint?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
}

function SettingsRow({ icon: Icon, label, hint, children, onClick }: RowProps) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blush-50">
        <Icon size={19} strokeWidth={1.9} className="text-blush-700" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-[13px] leading-snug text-muted">{hint}</span>}
      </span>
      {children}
    </>
  );
  const className = "flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left";

  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className={`${className} transition-colors duration-200 hover:bg-blush-50/70`}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

function SettingsGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <div className="mb-2 px-1">
        <h2 className="text-sm font-semibold text-ink-soft">{title}</h2>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      <Card padded={false} className="p-2">
        <ul>{children}</ul>
      </Card>
    </section>
  );
}

const Value = ({ children }: { children: ReactNode }) => (
  <span className="flex shrink-0 items-center gap-1 text-[15px] text-muted">
    {children}
    <ChevronRight size={18} aria-hidden />
  </span>
);

export function SettingsScreen() {
  const { categories, plan, resetDemo } = useBudget();
  const { showToast, discreet, setDiscreet, openCategorySheet } = useUI();
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [billReminders, setBillReminders] = useState(true);
  const [eveningReminder, setEveningReminder] = useState(false);
  const soon = () => showToast("Disponible dans une prochaine version");

  const expenseCategories = categories.filter(isExpenseCategory);
  const variableBudget = expenseCategories.filter((c) => c.group === "variables").reduce((acc, c) => acc + (plan.planned[c.id] ?? 0), 0);

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Ton espace, à ta façon" showSettings={false} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-6">
          <SettingsGroup title="Compte">
            <li className="flex items-center gap-4 px-3 py-3">
              <BrandMark size={52} />
              <div className="min-w-0">
                <p className="text-[17px] font-semibold tracking-tight">Mon espace {appConfig.name}</p>
                <p className="text-sm text-muted">Mode démo · données fictives, rien n&apos;est enregistré</p>
              </div>
            </li>
            <SettingsRow icon={Wallet} label="Mes comptes" hint="Courant, joint, espèces, Livret A" onClick={soon}>
              <Value>{Object.keys(accounts).length}</Value>
            </SettingsRow>
            <SettingsRow icon={Landmark} label="Connexion bancaire" hint="Importer tes opérations automatiquement" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Repeat} label="Synchronisation" hint="Retrouver tes données sur tous tes appareils" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Préférences">
            <SettingsRow icon={EyeOff} label="Mode discret" hint="Floute les montants, pratique en public">
              <Toggle
                checked={discreet}
                onChange={(value) => {
                  setDiscreet(value);
                  showToast(value ? "Montants masqués" : "Montants visibles");
                }}
                label="Mode discret"
              />
            </SettingsRow>
            <SettingsRow icon={Palette} label="Apparence" hint="Rose poudré" onClick={soon}>
              <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {["bg-blush-300", "bg-lilac-100", "bg-sage-100", "bg-peach-100"].map((color) => (
                  <span key={color} className={`size-5 rounded-full ring-2 ring-surface ${color}`} />
                ))}
              </span>
            </SettingsRow>
            <SettingsRow icon={Moon} label="Thème sombre" hint="Pour les soirées" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Coins} label="Devise" onClick={soon}>
              <Value>Euro (€)</Value>
            </SettingsRow>
            <SettingsRow icon={Globe} label="Langue" onClick={soon}>
              <Value>Français</Value>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Catégories" description="Utilisées pour classer tes dépenses et construire ton budget.">
            <li className="px-3 py-3">
              <ul className="flex flex-wrap gap-2" aria-label="Catégories de dépenses">
                {expenseCategories.map((category) => (
                  <li key={category.id} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium">
                    <span aria-hidden>{category.emoji}</span>
                    {category.label}
                  </li>
                ))}
              </ul>
            </li>
            <SettingsRow icon={Plus} label="Ajouter une catégorie" hint="Nom, icône, couleur et budget" onClick={openCategorySheet}>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </SettingsRow>
          </SettingsGroup>
        </div>

        <div className="flex flex-col gap-6">
          <SettingsGroup title="Budget">
            <SettingsRow icon={CalendarDays} label="Début du mois budgétaire" onClick={soon}>
              <Value>Le 1er</Value>
            </SettingsRow>
            <SettingsRow icon={Sparkles} label="Budget du quotidien" hint="Courses, sorties, imprévus" onClick={soon}>
              <Value>
                <Money value={variableBudget} />
              </Value>
            </SettingsRow>
            <SettingsRow icon={Sprout} label="Épargne mensuelle" hint="Répartie entre tes objectifs" onClick={soon}>
              <Value>
                <Money value={plan.planned.epargne ?? 0} />
              </Value>
            </SettingsRow>
            <SettingsRow icon={CalendarClock} label="Dépense « importante »" hint="Seuil d'affichage dans le calendrier" onClick={soon}>
              <Value>
                <Money value={appConfig.largeExpenseThreshold} />
              </Value>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Notifications" description="Aperçu : les rappels réels arriveront avec l'application installable.">
            <SettingsRow icon={Bell} label="Alertes de budget" hint="Quand une catégorie approche de sa limite">
              <Toggle checked={budgetAlerts} onChange={setBudgetAlerts} label="Alertes de budget" />
            </SettingsRow>
            <SettingsRow icon={CalendarClock} label="Rappel des prélèvements" hint="La veille d'un loyer ou d'une facture">
              <Toggle checked={billReminders} onChange={setBillReminders} label="Rappel des prélèvements" />
            </SettingsRow>
            <SettingsRow icon={Smartphone} label="Rappel du soir" hint="Penser à noter ses dépenses">
              <Toggle checked={eveningReminder} onChange={setEveningReminder} label="Rappel du soir" />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Sécurité">
            <SettingsRow icon={Lock} label="Code de verrouillage" hint="Protéger l'ouverture de l'application" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Fingerprint} label="Face ID / empreinte" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Download} label="Exporter mes données" hint="Fichier CSV" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={ShieldCheck} label="Confidentialité" hint="En démo, tout reste dans ce navigateur" />
          </SettingsGroup>

          <SettingsGroup title="À propos">
            <SettingsRow icon={Info} label={`${appConfig.name} · prototype ${appConfig.version}`} hint={appConfig.tagline} />
            <SettingsRow
              icon={RotateCcw}
              label="Réinitialiser la démo"
              hint="Revenir aux données d'exemple"
              onClick={() => {
                resetDemo();
                showToast("Données de démo restaurées");
              }}
            >
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </SettingsRow>
          </SettingsGroup>
        </div>
      </div>
    </>
  );
}
