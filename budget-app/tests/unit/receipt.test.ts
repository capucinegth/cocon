/** Lecture des tickets de caisse (texte reconnu par l'OCR → montant, date, magasin). */
import { describe, expect, it } from "vitest";
import { parseReceipt } from "@/lib/receipt";

const today = "2026-10-15";

describe("ticket de caisse : montant payé", () => {
  it("supermarché : le TOTAL, pas la TVA, le sous-total ni le rendu", () => {
    const text = `CARREFOUR MARKET
12 RUE DES LILAS 75011 PARIS
TEL 01 23 45 67 89
14/10/2026 18:42
PAIN DE MIE        1,89
LAIT DEMI ECREME   2,35
POMMES 1,2 KG      3,58
SOUS-TOTAL         7,82
REMISE FIDELITE   -0,50
TOTAL TTC          7,32 EUR
CB                 7,32
TVA 5,5%           0,38
RENDU              0,00
MERCI DE VOTRE VISITE`;
    expect(parseReceipt(text, today)).toEqual({ amount: 7.32, date: "2026-10-14", merchant: "Carrefour Market" });
  });

  it("« NET À PAYER » avec accent et symbole euro", () => {
    expect(parseReceipt("BOULANGERIE DUPONT\nBaguette 1,10\nCroissant x2 2,40\nNet à payer : 3,50 €", today).amount).toBe(3.5);
  });

  it("ticket en deux colonnes : montant sur la ligne suivante", () => {
    expect(parseReceipt("PHARMACIE\nTOTAL\n18,90\nCARTE\n18,90", today).amount).toBe(18.9);
  });

  it("erreurs de lecture : « T0TAL », point décimal, espaces parasites", () => {
    expect(parseReceipt("MONOP\nYAOURTS 2.15\nT0TAL 12. 40", today).amount).toBe(12.4);
    expect(parseReceipt("CAFE\nTOTAL 4, 80", today).amount).toBe(4.8);
  });

  it("milliers : « 1 234,56 »", () => {
    expect(parseReceipt("ELECTROMENAGER\nLAVE-LINGE 1 234,56\nTOTAL A PAYER 1 234,56", today).amount).toBe(1234.56);
  });

  it("sans mot-clé lisible : le plus grand montant (hors TVA / rendu)", () => {
    expect(parseReceipt("MARCHE\nTOMATES 2,40\nFROMAGE 6,90\n9,30\nTVA 0,51", today).amount).toBe(9.3);
  });

  it("le dernier total du ticket l'emporte à mot-clé égal", () => {
    expect(parseReceipt("RESTAURANT\nTOTAL 32,00\nPOURBOIRE 3,00\nTOTAL 35,00", today).amount).toBe(35);
  });

  it("aucun montant : rien n'est proposé", () => {
    expect(parseReceipt("photo floue\n???", today)).toEqual({ amount: undefined, date: undefined, merchant: "Photo Floue" });
    expect(parseReceipt("", today)).toEqual({});
  });
});

describe("ticket de caisse : date et magasin", () => {
  it("dates jj/mm/aa et jj.mm.aaaa ; jamais dans le futur ni de plus d'un an", () => {
    expect(parseReceipt("X\n03.10.26 12:00\nTOTAL 1,00", today).date).toBe("2026-10-03");
    expect(parseReceipt("X\n16/10/2026\nTOTAL 1,00", today).date).toBeUndefined();
    expect(parseReceipt("X\n01/01/2024\nTOTAL 1,00", today).date).toBeUndefined();
    expect(parseReceipt("X\n31/02/2026\nTOTAL 1,00", today).date).toBeUndefined();
  });

  it("magasin : première ligne lisible, en ignorant « BIENVENUE », téléphone, adresse", () => {
    expect(parseReceipt("BIENVENUE\nTEL 0123456789\nLeclerc Drive\nTOTAL 5,00", today).merchant).toBe("Leclerc Drive");
    expect(parseReceipt("*** FRANPRIX ***\nTOTAL 5,00", today).merchant).toBe("Franprix");
  });
});
