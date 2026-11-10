/** Tuto de découverte : « déjà vu » retenu dans les préférences du profil. */
import { describe, expect, it } from "vitest";
import { tutorialSteps } from "@/features/help/tutorial-sheet";
import { createDemoState } from "@/services/demo-repository";
import { profileFromRow } from "@/services/mappers";
import { withProfile } from "@/store/budget-state";
import { makeState } from "./fixtures";

describe("tuto de découverte", () => {
  it("la préférence est lue depuis la base ; une valeur invalide est ignorée", () => {
    expect(profileFromRow({ id: "u1", display_name: null, preferences: { tutorialSeen: true } }).preferences.tutorialSeen).toBe(true);
    expect(profileFromRow({ id: "u1", display_name: null, preferences: { tutorialSeen: "oui" } }).preferences.tutorialSeen).toBeUndefined();
    expect(profileFromRow({ id: "u1", display_name: null, preferences: null }).preferences.tutorialSeen).toBeUndefined();
  });

  it("marquer le tuto comme vu garde les autres préférences (mode discret)", () => {
    const state = makeState({ profile: { id: "u1", displayName: "Camille", preferences: { discreet: true } } });
    expect(withProfile(state, { preferences: { tutorialSeen: true } }).profile?.preferences).toEqual({ discreet: true, tutorialSeen: true });
  });

  it("démo : déjà vu, le tuto ne s'ouvre pas tout seul", () => {
    expect(createDemoState().profile?.preferences.tutorialSeen).toBe(true);
  });

  it("7 étapes, chacune avec un titre et un texte", () => {
    expect(tutorialSteps).toHaveLength(7);
    for (const step of tutorialSteps) expect(step.title.length * step.text.length).toBeGreaterThan(0);
  });
});
