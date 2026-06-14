// packages/invoker/test/cron.test.ts
import { describe, it, expect } from "vitest";
import { PRESETS, presetToCron, nextRun, validateCron, cadenceLabel } from "../src/cron";

describe("cron helpers", () => {
  it("maps presets to cron strings", () => {
    expect(presetToCron("hourly")).toBe("0 * * * *");
    expect(presetToCron("every_6h")).toBe("0 */6 * * *");
    expect(presetToCron("daily")).toBe("0 9 * * *");
    expect(presetToCron("weekly")).toBe("0 9 * * 1");
    expect(presetToCron("nope")).toBeNull();
    expect(Object.keys(PRESETS)).toHaveLength(4);
  });

  it("computes the next run (UTC) after a given time", () => {
    const from = new Date("2026-06-15T08:30:00.000Z");
    expect(nextRun("0 9 * * *", from).toISOString()).toBe("2026-06-15T09:00:00.000Z");
  });

  it("accepts hourly-or-slower crons", () => {
    expect(validateCron("0 * * * *").ok).toBe(true);
    expect(validateCron("0 9 * * *").ok).toBe(true);
  });

  it("rejects sub-hourly and garbage crons", () => {
    expect(validateCron("* * * * *").ok).toBe(false);
    expect(validateCron("not-a-cron").ok).toBe(false);
  });

  it("labels known presets, falls back to the raw cron", () => {
    expect(cadenceLabel("0 9 * * *")).toBe("Daily 09:00 UTC");
    expect(cadenceLabel("30 3 * * 2")).toBe("30 3 * * 2");
  });
});
