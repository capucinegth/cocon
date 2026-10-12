/**
 * Export CSV des opérations (séparateur « ; » et virgule décimale : s'ouvre
 * directement dans Excel / Numbers en français). Généré sur l'appareil, rien n'est envoyé.
 */
import { findAccount } from "@/config/accounts";
import { findCategory } from "@/config/categories";
import type { Account, Category, SavingsGoal, Transaction } from "@/types/finance";

const kindLabel = { expense: "Dépense", income: "Revenu", saving: "Épargne" } as const;

/** Texte saisi par l'utilisateur : neutralise les formules (=, +, -, @) et échappe les guillemets. */
function textCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function transactionsToCsv(
  transactions: Transaction[],
  lookups: { categories: Category[]; accounts: Account[]; goals: SavingsGoal[] },
): string {
  const header = ["Date", "Libellé", "Type", "Catégorie", "Objectif", "Compte", "Montant (€)", "Note"];
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const signed = t.kind === "income" ? t.amount : -t.amount;
      return [
        t.date,
        textCell(t.label),
        kindLabel[t.kind],
        textCell(findCategory(lookups.categories, t.categoryId).label),
        textCell(lookups.goals.find((g) => g.id === t.goalId)?.label ?? ""),
        // Transfert d'épargne : « compte source → compte d'épargne ».
        textCell(
          t.kind === "saving" && t.transferAccountId
            ? `${findAccount(lookups.accounts, t.accountId).label} → ${findAccount(lookups.accounts, t.transferAccountId).label}`
            : findAccount(lookups.accounts, t.accountId).label,
        ),
        // Montant calculé (jamais saisi tel quel) : écrit comme un nombre, signe compris.
        signed.toFixed(2).replace(".", ","),
        textCell(t.note ?? ""),
      ];
    });
  return [header.map(textCell), ...rows].map((row) => row.join(";")).join("\r\n");
}

/** Télécharge un texte en fichier (BOM UTF-8 pour les accents dans Excel). */
export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
