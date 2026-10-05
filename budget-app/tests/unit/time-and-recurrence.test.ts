import { describe, expect, it } from "vitest";
import { todayInParis } from "@/lib/paris-time";
import { materializeRecurring, nextOccurrenceDate, projectRecurring } from "@/lib/recurrence";
import type { RecurringRule } from "@/types/finance";

describe("date du jour en heure de Paris", () => {
  it("après 22 h UTC en été, on est déjà le lendemain à Paris (UTC+2)", () => {
    expect(todayInParis(new Date("2026-10-04T22:30:00Z"))).toBe("2026-10-05");
    expect(todayInParis(new Date("2026-10-04T21:59:00Z"))).toBe("2026-10-04");
  });

  it("en hiver (UTC+1), le passage à la nouvelle année se fait à 23 h UTC", () => {
    expect(todayInParis(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31");
    expect(todayInParis(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });

  it("le jour du changement d'heure reste correct", () => {
    expect(todayInParis(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    expect(todayInParis(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});

const rule = (partial: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "r1",
  label: "Loyer",
  amount: 650,
  kind: "expense",
  categoryId: "logement",
  accountId: "courant",
  frequency: "monthly",
  nextOccurrence: "2026-01-31",
  anchorDay: 31,
  isActive: true,
  ...partial,
});

describe("récurrences", () => {
  it("mensuel : un « 31 » reste en fin de mois sans dériver", () => {
    expect(nextOccurrenceDate("2026-01-31", "monthly", 31)).toBe("2026-02-28");
    expect(nextOccurrenceDate("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrenceDate("2027-12-31", "monthly", 31)).toBe("2028-01-31");
    expect(nextOccurrenceDate("2028-01-30", "monthly", 30)).toBe("2028-02-29");
  });

  it("hebdomadaire : +7 jours, y compris en changeant de mois", () => {
    expect(nextOccurrenceDate("2026-09-27", "weekly")).toBe("2026-10-04");
  });

  it("projette les prochaines échéances du mois, sans doublon ni date passée", () => {
    const weekly = rule({ id: "w", frequency: "weekly", nextOccurrence: "2026-09-13", anchorDay: undefined, amount: 12.5 });
    const items = projectRecurring([weekly], [{ recurrenceId: "w", date: "2026-09-20" }], "2026-09-13", "2026-09-30");
    expect(items.map((i) => i.date)).toEqual(["2026-09-27"]);
    expect(items[0].origin).toBe("recurring");
  });

  it("une règle en pause ne génère rien", () => {
    expect(projectRecurring([rule({ isActive: false, nextOccurrence: "2026-09-20" })], [], "2026-09-13", "2026-09-30")).toEqual([]);
  });

  it("génère les opérations dues une seule fois et avance la règle", () => {
    let n = 0;
    const id = () => `g${++n}`;
    const first = materializeRecurring([rule()], [], "2026-04-30", id);
    expect(first.created.map((t) => t.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(first.rules[0].nextOccurrence).toBe("2026-05-31");
    const again = materializeRecurring(first.rules, first.transactions, "2026-04-30", id);
    expect(again.created).toHaveLength(0);
  });
});
