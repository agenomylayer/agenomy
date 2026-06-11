import { describe, it, expect } from "vitest";
import {
  validateHandleFormat,
  availabilityReducer,
  initialAvailabilityState,
  type AvailabilityState,
} from "./handleAvailability";

describe("validateHandleFormat", () => {
  it("rejects too short", () => {
    expect(validateHandleFormat("ab")).toEqual({
      ok: false,
      reason: "Handle must be 3-32 characters.",
    });
  });
  it("rejects too long", () => {
    expect(validateHandleFormat("a".repeat(33))).toEqual({
      ok: false,
      reason: "Handle must be 3-32 characters.",
    });
  });
  it("rejects uppercase and bad chars", () => {
    expect(validateHandleFormat("Scout").ok).toBe(false);
    expect(validateHandleFormat("scout_01").ok).toBe(false);
    expect(validateHandleFormat("sco ut").ok).toBe(false);
  });
  it("accepts lowercase, digits, and hyphen", () => {
    expect(validateHandleFormat("scout-01")).toEqual({ ok: true });
  });
});

describe("availabilityReducer", () => {
  it("invalid format short-circuits to invalid", () => {
    const s = availabilityReducer(initialAvailabilityState, {
      type: "input",
      handle: "ab",
    });
    expect(s.status).toBe("invalid");
    expect(s.reason).toBe("Handle must be 3-32 characters.");
  });

  it("valid format moves to checking", () => {
    const s = availabilityReducer(initialAvailabilityState, {
      type: "input",
      handle: "scout-01",
    });
    expect(s.status).toBe("checking");
    expect(s.handle).toBe("scout-01");
  });

  it("resolves available only when handle still matches", () => {
    const checking: AvailabilityState = {
      status: "checking",
      handle: "scout-01",
      reason: undefined,
    };
    const ok = availabilityReducer(checking, {
      type: "result",
      handle: "scout-01",
      available: true,
    });
    expect(ok.status).toBe("available");

    const stale = availabilityReducer(checking, {
      type: "result",
      handle: "old-handle",
      available: true,
    });
    expect(stale.status).toBe("checking"); // ignored stale result
  });

  it("resolves taken with reason", () => {
    const checking: AvailabilityState = {
      status: "checking",
      handle: "scout-01",
      reason: undefined,
    };
    const taken = availabilityReducer(checking, {
      type: "result",
      handle: "scout-01",
      available: false,
      reason: "taken",
    });
    expect(taken.status).toBe("taken");
    expect(taken.reason).toBe("taken");
  });
});
