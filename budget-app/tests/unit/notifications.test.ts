import { describe, expect, it } from "vitest";
import { planReminders } from "@/services/notifications";
import { makeData, tx } from "./fixtures";

describe("rappels (architecture préparée, rien n'est envoyé)", () => {
  const data = makeData({
    transactions: [tx("2026-09-14", 650, "expense", "logement", { label: "Loyer" }), tx("2026-09-05", 270, "expense", "courses")],
    plans: [{ month: "2026-09", planned: { courses: 300, logement: 650 }, incomeTarget: 2000, savingsTarget: 0 }],
  });

  it("veille d'un prélèvement et catégorie proche de sa limite", () => {
    const reminders = planReminders(data, {});
    expect(reminders.map((r) => r.kind)).toEqual(["bill", "budget"]);
    expect(reminders[0].title).toBe("Demain : Loyer");
    expect(reminders[1].title).toBe("Courses : 90 % du budget");
  });

  it("respecte les préférences enregistrées", () => {
    expect(planReminders(data, { notifications: { billReminders: false, budgetAlerts: false } })).toEqual([]);
    expect(planReminders(data, { notifications: { billReminders: false, budgetAlerts: false, eveningReminder: true } }).map((r) => r.kind)).toEqual(["evening"]);
  });
});
