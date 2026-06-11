import type { Address } from "viem";
import type { Persona } from "@aeonomy/shared";

export const STEPS = [
  "connect",
  "handle",
  "skills",
  "persona",
  "review",
] as const;

export type WizardStep = (typeof STEPS)[number];

export interface WizardState {
  step: WizardStep;
  connected: boolean;
  owner?: Address;
  handle: string;
  handleAvailable: boolean;
  skills: string[];
  persona: Persona;
}

export const initialWizardState: WizardState = {
  step: "connect",
  connected: false,
  owner: undefined,
  handle: "",
  handleAvailable: false,
  skills: [],
  persona: { displayName: "", bio: "", avatarSeed: "" },
};

export function canAdvance(state: WizardState): boolean {
  switch (state.step) {
    case "connect":
      return state.connected && Boolean(state.owner);
    case "handle":
      return state.handle.length >= 3 && state.handleAvailable;
    case "skills":
      return state.skills.length >= 1;
    case "persona":
      return state.persona.displayName.trim().length > 0;
    case "review":
      return true;
    default:
      return false;
  }
}

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "setConnected"; connected: boolean; owner?: Address }
  | { type: "setHandle"; handle: string }
  | { type: "setHandleAvailable"; available: boolean }
  | { type: "toggleSkill"; slug: string }
  | { type: "setPersona"; persona: Persona };

function stepIndex(step: WizardStep): number {
  return STEPS.indexOf(step);
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "next": {
      if (!canAdvance(state)) return state;
      const idx = stepIndex(state.step);
      const nextIdx = Math.min(idx + 1, STEPS.length - 1);
      return { ...state, step: STEPS[nextIdx] };
    }
    case "back": {
      const idx = stepIndex(state.step);
      const prevIdx = Math.max(idx - 1, 0);
      return { ...state, step: STEPS[prevIdx] };
    }
    case "setConnected":
      return {
        ...state,
        connected: action.connected,
        owner: action.owner,
      };
    case "setHandle":
      return {
        ...state,
        handle: action.handle,
        handleAvailable: false,
        persona:
          state.persona.avatarSeed.length === 0
            ? { ...state.persona, avatarSeed: action.handle }
            : state.persona,
      };
    case "setHandleAvailable":
      return { ...state, handleAvailable: action.available };
    case "toggleSkill": {
      const has = state.skills.includes(action.slug);
      return {
        ...state,
        skills: has
          ? state.skills.filter((s) => s !== action.slug)
          : [...state.skills, action.slug],
      };
    }
    case "setPersona":
      return { ...state, persona: action.persona };
    default:
      return state;
  }
}
