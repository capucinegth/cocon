import type { SavingsGoal } from "@/types/finance";
import { addMonths, monthKey } from "./dates";
import { roundCents } from "./format";

export type GoalPace = "done" | "ahead" | "on-track" | "late" | "no-deadline";

export interface GoalProgress {
  ratio: number;
  remaining: number;
  /** Mois estimé d'atteinte au rythme actuel (AAAA-MM). */
  eta?: string;
  pace: GoalPace;
}

/** Où en est un objectif, et l'atteindra-t-on à temps au rythme actuel ? */
export function getGoalProgress(goal: SavingsGoal, today: string): GoalProgress {
  const remaining = Math.max(roundCents(goal.target - goal.saved), 0);
  const ratio = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 0;
  if (remaining === 0) return { ratio: 1, remaining: 0, pace: "done" };

  const eta =
    goal.monthlyContribution > 0 ? addMonths(monthKey(today), Math.ceil(remaining / goal.monthlyContribution)) : undefined;
  if (!goal.deadline) return { ratio, remaining, eta, pace: "no-deadline" };
  if (!eta) return { ratio, remaining, pace: "late" };
  if (eta < goal.deadline) return { ratio, remaining, eta, pace: "ahead" };
  if (eta === goal.deadline) return { ratio, remaining, eta, pace: "on-track" };
  return { ratio, remaining, eta, pace: "late" };
}
