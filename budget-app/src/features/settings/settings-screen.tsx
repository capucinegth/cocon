"use client";

import {
  Bell,
  CalendarDays,
  ChevronRight,
  Coins,
  Download,
  EyeOff,
  Landmark,
  Palette,
  Repeat,
  RotateCcw,
  Smartphone,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { accounts } from "@/config/accounts";
import { appConfig } from "@/config/app";
import { categories } from "@/config/categories";
import { useBudget } from "@/store/budget-store";
import { useUI } from "@/store/ui-store";

function SoonBadge() {
  return <span className="rounded-full bg-lilac-50 px-2.5 py-1 text-[12px] font-semibold text-lilac-700">Bientôt</span>;
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
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
        <span className="block truncate text-[15px] font-semibold">{label}</span>
        {hint && <span className="block truncate text-[13px] text-muted">{hint}</span>}
      </span>
      {children}
    </>
  );
  const className = "flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left";

  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className={`${className} transition-colors hover:bg-blush-50/60`}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="animate-rise">
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{title}</h2>
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
  const { resetDemo } = useBudget();
  const { showToast } = useUI();
  const [notifications, setNotifications] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [discreet, setDiscreet] = useState(false);
  const soon = () => showToast("Disponible dans une prochaine version");

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Ton espace, à ta façon" showSettings={false} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex animate-rise items-center gap-4 rounded-card bg-blush-50 p-5">
            <BrandMark size={56} />
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight">Mon espace {appConfig.name}</p>
              <p className="text-sm text-muted">Mode démo · données fictives, rien n&apos;est enregistré</p>
            </div>
          </div>

          <SettingsGroup title="Budget">
            <SettingsRow icon={CalendarDays} label="Début du mois budgétaire" onClick={soon}>
              <Value>Le 1er</Value>
            </SettingsRow>
            <SettingsRow icon={Coins} label="Devise" onClick={soon}>
              <Value>Euro (€)</Value>
            </SettingsRow>
            <SettingsRow icon={Tag} label="Catégories" onClick={soon}>
              <Value>{Object.keys(categories).length}</Value>
            </SettingsRow>
            <SettingsRow icon={Wallet} label="Comptes" onClick={soon}>
              <Value>{Object.keys(accounts).length}</Value>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Préférences">
            <SettingsRow icon={Bell} label="Notifications" hint="Alertes de budget et prélèvements">
              <Toggle checked={notifications} onChange={setNotifications} label="Notifications" />
            </SettingsRow>
            <SettingsRow icon={CalendarDays} label="Rappel du soir" hint="Penser à noter ses dépenses">
              <Toggle checked={dailyReminder} onChange={setDailyReminder} label="Rappel du soir" />
            </SettingsRow>
            <SettingsRow icon={EyeOff} label="Mode discret" hint="Masquer les montants en public">
              <Toggle checked={discreet} onChange={setDiscreet} label="Mode discret" />
            </SettingsRow>
            <SettingsRow icon={Palette} label="Apparence" hint="Rose poudré" onClick={soon}>
              <span className="flex shrink-0 -space-x-1.5" aria-hidden>
                {["bg-blush-300", "bg-lilac-100", "bg-sage-100", "bg-peach-100"].map((color) => (
                  <span key={color} className={`size-5 rounded-full ring-2 ring-surface ${color}`} />
                ))}
              </span>
            </SettingsRow>
          </SettingsGroup>
        </div>

        <div className="flex flex-col gap-6">
          <SettingsGroup title="Connexions">
            <SettingsRow icon={Landmark} label="Connexion bancaire" hint="Synchroniser tes comptes" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Repeat} label="Synchronisation" hint="Retrouver tes données partout" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
            <SettingsRow icon={Smartphone} label="Installer l'application" hint="Sur ton écran d'accueil" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Données">
            <SettingsRow icon={Download} label="Exporter mes données" hint="Fichier CSV" onClick={soon}>
              <SoonBadge />
            </SettingsRow>
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

          <p className="px-1 text-center text-[13px] text-muted lg:text-left">
            {appConfig.name} · prototype 0.1 — fait avec douceur
          </p>
        </div>
      </div>
    </>
  );
}
