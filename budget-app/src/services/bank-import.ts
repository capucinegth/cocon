/**
 * Connexion bancaire — ARCHITECTURE PRÉPARÉE, NON BRANCHÉE (rien n'est affiché dans l'application).
 *
 * Principes non négociables :
 *   - Cocon ne demande, ne voit et ne stocke JAMAIS d'identifiant ni de mot de passe bancaire.
 *   - La connexion passe par un agrégateur agréé DSP2 (ex. prestataire d'information sur les comptes) :
 *     l'utilisateur s'authentifie chez SA banque, via une redirection, puis revient dans Cocon.
 *   - Seuls des jetons d'accès délivrés par l'agrégateur sont conservés, côté serveur uniquement
 *     (jamais dans le navigateur), chiffrés, révocables à tout moment depuis les Paramètres.
 *   - Les opérations importées arrivent dans `transactions` avec `source = 'import'` et un
 *     `external_id` unique par utilisateur (index déjà en base) : un import rejoué ne crée aucun doublon.
 */
import type { TransactionKind } from "@/types/finance";

/** Opération telle que fournie par l'agrégateur, avant rapprochement avec les catégories. */
export interface ImportedTransaction {
  /** Identifiant chez le fournisseur : clé de dédoublonnage (`transactions.external_id`). */
  externalId: string;
  accountExternalId: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  label: string;
}

/** Contrat d'un fournisseur d'agrégation (implémenté côté serveur, jamais dans le navigateur). */
export interface BankImportProvider {
  readonly name: string;
  /** URL de redirection vers la banque (consentement DSP2), avec retour vers Cocon. */
  startConsent(userId: string, returnUrl: string): Promise<{ redirectUrl: string }>;
  /** Échange le code de retour contre un accès, conservé côté serveur. */
  completeConsent(userId: string, code: string): Promise<void>;
  /** Opérations depuis une date, pour les comptes autorisés. */
  fetchTransactions(userId: string, since: string): Promise<ImportedTransaction[]>;
  /** Révocation à la demande de l'utilisateur. */
  revoke(userId: string): Promise<void>;
}

/** Aucun fournisseur n'est branché pour l'instant. */
export const bankImportAvailable = false;
