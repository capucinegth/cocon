"use client";

import {
  ArchiveRestore,
  ChevronRight,
  Coins,
  Download,
  EyeOff,
  Info,
  KeyRound,
  LogOut,
  Plus,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sprout,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Toggle } from "@/components/ui/toggle";
import { appConfig } from "@/config/app";
import { isExpenseCategory } from "@/config/categories";
import { accountBalance, accountTypeLabel, liquidBalance, netWorth } from "@/lib/accounts";
import { planFor } from "@/lib/budget";
import { downloadText, transactionsToCsv } from "@/lib/export";
import { errorMessage } from "@/services/repository";
import { hasActiveCategoryNamed } from "@/store/budget-state";
import { useBudget } from "@/store/budget-store";
import { useSession } from "@/store/session-store";
import { useUI } from "@/store/ui-store";

function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded-full bg-sage-50 px-2.5 py-1 text-[12px] font-semibold text-sage-700">{children}</span>;
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
  const data = useBudget();
  const { categories, accounts, profile, source, currentMonth, resetDemo, updateProfile, restoreCategory } = data;
  const { signOut } = useSession();
  const { showToast, showError, discreet, setDiscreet, openCategorySheet, openCategoryEdit, openProfile, openTargets, openAccount, openPassword } = useUI();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const isDemo = source === "demo";

  const expenseCategories = categories.filter((c) => isExpenseCategory(c) && !c.archived);
  const categorySections = [
    { title: "Dépenses", items: expenseCategories },
    { title: "Revenus", items: categories.filter((c) => c.group === "revenus" && !c.archived) },
    { title: "Épargne", items: categories.filter((c) => c.group === "epargne" && !c.archived) },
  ];
  const archivedCategories = categories.filter((c) => c.archived);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function restore(id: string, label: string) {
    setRestoringId(id);
    try {
      await restoreCategory(id);
      showToast(`« ${label} » restaurée`);
    } catch (cause) {
      showError(errorMessage(cause));
    } finally {
      setRestoringId(null);
    }
  }
  const plan = planFor(data, currentMonth);
  const variableBudget = expenseCategories.filter((c) => c.group === "variables").reduce((acc, c) => acc + (plan?.planned[c.id] ?? 0), 0);

  function exportCsv() {
    if (data.allTransactions.length === 0) return showToast("Aucune opération à exporter pour l'instant");
    downloadText(`cocon-operations-${data.today}.csv`, transactionsToCsv(data.allTransactions, data));
    showToast("Export téléchargé");
  }

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Ton espace, à ta façon" showSettings={false} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-6">
          <SettingsGroup title="Compte">
            <li className="flex items-center gap-4 px-3 py-3">
              <BrandMark size={52} />
              <div className="min-w-0">
                <p className="break-words text-[17px] font-semibold tracking-tight">
                  {profile?.displayName ? `Espace de ${profile.displayName}` : `Mon espace ${appConfig.name}`}
                </p>
                <p className="break-words text-sm text-muted">
                  {isDemo ? <>Mode démo · données fictives, rien n&apos;est enregistré</> : (profile?.email ?? "Compte connecté")}
                </p>
              </div>
            </li>
            {!isDemo && (
              <SettingsRow icon={UserRound} label="Mon profil" hint="Prénom affiché sur l'accueil" onClick={openProfile}>
                <Value>{profile?.displayName || "—"}</Value>
              </SettingsRow>
            )}
            {!isDemo && (
              <SettingsRow icon={KeyRound} label="Modifier le mot de passe" hint="Pour te connecter sur tous tes appareils" onClick={() => openPassword()}>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </SettingsRow>
            )}
            {!isDemo && (
              <SettingsRow icon={Repeat} label="Synchronisation" hint="Tes données sont enregistrées et retrouvées sur tous tes appareils">
                <StatusBadge>Activée</StatusBadge>
              </SettingsRow>
            )}
            {!isDemo && (
              <SettingsRow
                icon={LogOut}
                label={signingOut ? "Déconnexion…" : "Se déconnecter"}
                hint="Tes données restent enregistrées dans ton compte"
                onClick={async () => {
                  if (signingOut) return;
                  setSigningOut(true);
                  try {
                    await signOut();
                  } catch {
                    setSigningOut(false);
                    showError("Déconnexion impossible pour le moment. Vérifie ta connexion puis réessaie.");
                  }
                }}
              >
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </SettingsRow>
            )}
          </SettingsGroup>

          <SettingsGroup
            title="Mes comptes"
            description="Soldes calculés : solde de départ + opérations et versements d'épargne saisis dans Cocon. Touche un compte pour le modifier."
          >
            {accounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => openAccount(account.id)}
                  aria-label={`Modifier le compte ${account.label}`}
                  className="flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-blush-50/70"
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-blush-50 text-xl">
                    {account.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] font-semibold">{account.label}</span>
                    <span className="block text-[13px] leading-snug text-muted">
                      {[account.label !== accountTypeLabel[account.type] ? accountTypeLabel[account.type] : null, account.isActive ? null : "désactivé"]
                        .filter(Boolean)
                        .join(" · ") || "Actif"}
                    </span>
                  </span>
                  <span className={`flex shrink-0 items-center gap-1 text-[15px] ${account.isActive ? "text-ink" : "text-muted"}`}>
                    <Money value={accountBalance(account, data.allTransactions, data.today)} cents="always" className="tabular font-semibold" />
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
            <li className="mt-1 flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">Solde total hors épargne</span>
                <span className="block text-[13px] text-muted">Comptes courants et espèces</span>
              </span>
              <Money value={liquidBalance(accounts, data.allTransactions, data.today)} cents="always" className="tabular shrink-0 text-[15px] font-semibold" />
            </li>
            <li className="mt-1 flex items-center justify-between gap-4 rounded-2xl bg-canvas px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">Patrimoine total</span>
                <span className="block text-[13px] text-muted">Tous tes comptes, épargne comprise</span>
              </span>
              <Money value={netWorth(accounts, data.allTransactions, data.today)} cents="always" className="tabular shrink-0 text-[15px] font-semibold" />
            </li>
          </SettingsGroup>

          <SettingsGroup title="Budget">
            <SettingsRow icon={Sparkles} label="Budget du quotidien" hint="Courses, sorties, imprévus" onClick={() => router.push("/budget")}>
              <Value>
                <Money value={variableBudget} />
              </Value>
            </SettingsRow>
            <SettingsRow icon={Coins} label="Revenus prévus" hint="Comptés tant qu'ils ne sont pas saisis" onClick={() => openTargets(currentMonth)}>
              <Value>
                <Money value={plan?.incomeTarget ?? 0} />
              </Value>
            </SettingsRow>
            <SettingsRow icon={Sprout} label="Épargne mensuelle" hint="Répartie entre tes objectifs" onClick={() => openTargets(currentMonth)}>
              <Value>
                <Money value={plan?.savingsTarget ?? 0} />
              </Value>
            </SettingsRow>
          </SettingsGroup>

        </div>

        <div className="flex flex-col gap-6">
          <SettingsGroup title="Catégories" description="Pour classer tes opérations et construire ton budget. Touche une catégorie pour la modifier.">
            {categorySections.map(
              ({ title, items }) =>
                items.length > 0 && (
                  <li key={title} className="px-3 py-3">
                    <p className="mb-2 text-[13px] font-semibold text-muted">{title}</p>
                    <ul className="flex flex-wrap gap-2" aria-label={`Catégories : ${title.toLowerCase()}`}>
                      {items.map((category) => (
                        <li key={category.id}>
                          <button
                            type="button"
                            onClick={() => openCategoryEdit(category.id, currentMonth)}
                            aria-label={`Modifier la catégorie ${category.label}`}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-blush-50"
                          >
                            <span aria-hidden>{category.emoji}</span>
                            {category.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ),
            )}
            {archivedCategories.length > 0 && (
              <li className="px-3 py-3">
                <p className="mb-1 text-[13px] font-semibold text-muted">Archivées</p>
                <p className="mb-2 text-[13px] text-muted">Plus proposées pour les nouvelles opérations ; leur historique est conservé.</p>
                <ul className="flex flex-col gap-1" aria-label="Catégories archivées">
                  {archivedCategories.map((category) => {
                    const conflict = hasActiveCategoryNamed(categories, category.label, category.id);
                    return (
                      <li key={category.id} className="flex min-h-12 items-center gap-3 rounded-2xl bg-canvas px-3 py-2">
                        <span aria-hidden className="text-lg">
                          {category.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-[15px] font-medium">{category.label}</span>
                          {conflict && <span className="block text-[12px] text-muted">Une catégorie active porte déjà ce nom</span>}
                        </span>
                        <Button
                          variant="accent"
                          size="sm"
                          disabled={conflict || restoringId !== null}
                          aria-busy={restoringId === category.id || undefined}
                          onClick={() => restore(category.id, category.label)}
                          aria-label={`Restaurer la catégorie ${category.label}`}
                        >
                          <ArchiveRestore size={16} aria-hidden />
                          {restoringId === category.id ? "…" : "Restaurer"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}
            <SettingsRow icon={Plus} label="Ajouter une catégorie" hint="Dépense ou revenu : nom, icône, couleur" onClick={openCategorySheet}>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Préférences">
            <SettingsRow icon={EyeOff} label="Mode discret" hint="Floute les montants, pratique en public">
              <Toggle
                checked={discreet}
                onChange={(value) => {
                  setDiscreet(value);
                  showToast(value ? "Montants masqués" : "Montants visibles");
                  if (!isDemo) updateProfile({ preferences: { discreet: value } }).catch((cause) => showError(errorMessage(cause)));
                }}
                label="Mode discret"
              />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title="Mes données">
            <SettingsRow icon={Download} label="Exporter mes données" hint="Fichier CSV de toutes tes opérations" onClick={exportCsv}>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </SettingsRow>
            <SettingsRow
              icon={ShieldCheck}
              label="Confidentialité"
              hint={isDemo ? "En démo, tout reste dans ce navigateur" : "Tes données sont privées : liées à ton compte, invisibles des autres utilisateurs"}
            />
          </SettingsGroup>

          <SettingsGroup title="À propos">
            <SettingsRow icon={Info} label={`${appConfig.name} · version ${appConfig.version}`} hint={appConfig.tagline} />
            {isDemo && (
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
            )}
          </SettingsGroup>
        </div>
      </div>
    </>
  );
}
