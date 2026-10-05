import type { SavingsGoal } from "@/types/finance";
import { monthKey } from "./dates";

export type GoalPace = "done" | "ahead" | "on-track" | "late" | "no-deadline";

export interface GoalProgress {
  ratio: number;
  remaining: number;
  /** Mois estimé d'atteinte au rythme actuel (AAAA-MM). */
  eta?: string;
  pace: GoalPace;
}

function addMonths(month: string, count: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Où en est un objectif, et l'atteindra-t-on à temps au rythme actuel ? */
export function getGoalProgress(goal: SavingsGoal, today: string): GoalProgress {
  const remaining = Math.max(goal.target - goal.saved, 0);
  const ratio = goal.target > 0 ? goal.saved / goal.target : 0;
  if (remaining === 0) return { ratio: 1, remaining: 0, pace: "done" };

  const eta =
    goal.monthlyContribution > 0 ? addMonths(monthKey(today), Math.ceil(remaining / goal.monthlyContribution)) : undefined;
  if (!goal.deadline) return { ratio, remaining, eta, pace: "no-deadline" };
  if (!eta) return { ratio, remaining, pace: "late" };
  if (eta < goal.deadline) return { ratio, remaining, eta, pace: "ahead" };
  if (eta === goal.deadline) return { ratio, remaining, eta, pace: "on-track" };
  return { ratio, remaining, eta, pace: "late" };
}
