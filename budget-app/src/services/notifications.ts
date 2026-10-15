/**
 * Notifications — ARCHITECTURE PRÉPARÉE, NON BRANCHÉE (aucun réglage affiché dans l'application).
 *
 * Ce module décide QUOI rappeler, à partir des données et des préférences enregistrées
 * dans le profil (`profiles.preferences.notifications`). L'envoi réel viendra ensuite :
 *   1. demander l'autorisation du navigateur (`Notification.requestPermission`) ;
 *   2. abonner l'appareil au Web Push (clé VAPID publique, abonnement stocké côté serveur) ;
 *   3. une fonction planifiée (Supabase Edge Function + cron) appelle `planReminders`
 *      pour chaque utilisateur et envoie les rappels du jour.
 * Rien n'est envoyé aujourd'hui ; aucune permission n'est demandée.
 */
import { getExpenseUsages, getUsageStatus, monthUpcoming } from "@/lib/budget";
import { addDays, monthKey } from "@/lib/dates";
import type { BudgetData } from "@/types/budget-data";
import type { Preferences } from "@/types/finance";

export type ReminderKind = "bill" | "budget" | "evening";

export interface Reminder {
  kind: ReminderKind;
  title: string;
  body: string;
}

export type NotificationSupport = "unsupported" | "default" | "granted" | "denied";

/** État du navigateur (sans rien demander). */
export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

const defaults = { budgetAlerts: true, billReminders: true, eveningReminder: false };

/** Rappels qui seraient envoyés aujourd'hui (fonction pure, testable). */
export function planReminders(data: BudgetData, preferences: Preferences): Reminder[] {
  const settings = { ...defaults, ...Object.fromEntries(Object.entries(preferences.notifications ?? {}).filter(([, v]) => v !== undefined)) };
  const reminders: Reminder[] = [];
  const month = monthKey(data.today);

  if (settings.billReminders) {
    const tomorrow = addDays(data.today, 1);
    monthUpcoming(data, month)
      .filter((item) => item.date === tomorrow && item.kind === "expense")
      .forEach((item) => reminders.push({ kind: "bill", title: `Demain : ${item.label}`, body: `${item.amount.toFixed(2).replace(".", ",")} € seront prélevés.` }));
  }

  if (settings.budgetAlerts) {
    getExpenseUsages(data, month)
      .filter((usage) => usage.planned > 0 && usage.category.group === "variables" && getUsageStatus(usage.ratio) !== "ok")
      .forEach((usage) =>
        reminders.push({
          kind: "budget",
          title: `${usage.category.label} : ${Math.round(usage.ratio * 100)} % du budget`,
          body: usage.remaining < 0 ? "Budget dépassé ce mois-ci." : "Tu approches de la limite prévue.",
        }),
      );
  }

  if (settings.eveningReminder) {
    reminders.push({ kind: "evening", title: "Tes dépenses du jour", body: "Un instant pour noter tes dépenses d'aujourd'hui ?" });
  }

  return reminders;
}
