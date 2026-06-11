import { describe, it, expect } from "vitest";
import {
  wizardReducer,
  initialWizardState,
  canAdvance,
  STEPS,
  type WizardState,
} from "./wizardMachine";

const OWNER = "0x00000000000000000000000000000000000000aa" as const;

function valid(): WizardState {
  return {
    step: "review",
    connected: true,
    owner: OWNER,
    handle: "scout-01",
    handleAvailable: true,
    skills: ["arxiv", "web-search"],
    persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
  };
}

describe("STEPS order", () => {
  it("is connect -> handle -> skills -> persona -> review", () => {
    expect(STEPS).toEqual([
      "connect",
      "handle",
      "skills",
      "persona",
      "review",
    ]);
  });
});

describe("canAdvance guards", () => {
  it("blocks connect until wallet connected", () => {
    expect(canAdvance({ ...initialWizardState, step: "connect" })).toBe(false);
    expect(
      canAdvance({ ...initialWizardState, step: "connect", connected: true, owner: OWNER }),
    ).toBe(true);
  });

  it("blocks handle step until available", () => {
    const base: WizardState = {
      ...initialWizardState,
      step: "handle",
      connected: true,
      owner: OWNER,
      handle: "scout-01",
      handleAvailable: false,
    };
    expect(canAdvance(base)).toBe(false);
    expect(canAdvance({ ...base, handleAvailable: true })).toBe(true);
  });

  it("blocks skills step until at least one skill", () => {
    const base: WizardState = { ...valid(), step: "skills", skills: [] };
    expect(canAdvance(base)).toBe(false);
    expect(canAdvance({ ...base, skills: ["arxiv"] })).toBe(true);
  });

  it("blocks persona step until displayName present", () => {
    const base: WizardState = {
      ...valid(),
      step: "persona",
      persona: { displayName: "", bio: "", avatarSeed: "scout-01" },
    };
    expect(canAdvance(base)).toBe(false);
    expect(
      canAdvance({
        ...base,
        persona: { displayName: "Scout", bio: "", avatarSeed: "scout-01" },
      }),
    ).toBe(true);
  });
});

describe("wizardReducer navigation", () => {
  it("next advances only when guard passes", () => {
    const s0: WizardState = {
      ...initialWizardState,
      step: "connect",
      connected: true,
      owner: OWNER,
    };
    const s1 = wizardReducer(s0, { type: "next" });
    expect(s1.step).toBe("handle");
  });

  it("next is a no-op when guard fails", () => {
    const s0: WizardState = { ...initialWizardState, step: "connect" };
    const s1 = wizardReducer(s0, { type: "next" });
    expect(s1.step).toBe("connect");
  });

  it("back moves to previous step and never below connect", () => {
    const atHandle: WizardState = { ...valid(), step: "handle" };
    expect(wizardReducer(atHandle, { type: "back" }).step).toBe("connect");
    const atConnect: WizardState = { ...valid(), step: "connect" };
    expect(wizardReducer(atConnect, { type: "back" }).step).toBe("connect");
  });

  it("setHandle resets availability to unknown", () => {
    const s = wizardReducer(valid(), { type: "setHandle", handle: "new-name" });
    expect(s.handle).toBe("new-name");
    expect(s.handleAvailable).toBe(false);
  });

  it("toggleSkill adds then removes", () => {
    const added = wizardReducer({ ...valid(), skills: [] }, {
      type: "toggleSkill",
      slug: "arxiv",
    });
    expect(added.skills).toEqual(["arxiv"]);
    const removed = wizardReducer(added, { type: "toggleSkill", slug: "arxiv" });
    expect(removed.skills).toEqual([]);
  });
});
