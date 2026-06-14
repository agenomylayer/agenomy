import { describe, it, expect } from "vitest";
import { runOnce, type SchedulerDeps } from "../src/scheduler";
import type { ScheduleRow } from "@agenomy/invoker";

function row(over: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    id: "1",
    agent_handle: "gas",
    skill_slug: "base-gas-check",
    input: "",
    cron: "0 * * * *",
    enabled: true,
    last_run_at: null,
    next_run_at: "2026-06-15T08:00:00.000Z",
    created_at: "2026-06-15T00:00:00.000Z",
    ...over,
  };
}

function baseDeps(over: Partial<SchedulerDeps> = {}): SchedulerDeps {
  return {
    now: () => new Date("2026-06-15T08:30:00.000Z"),
    dueSchedules: async () => [row()],
    claimNextRun: async () => {},
    markRan: async () => {},
    invoke: async () => {},
    scheduledRunsSince: async () => 0,
    dailyCap: 500,
    ...over,
  };
}

describe("scheduler.runOnce", () => {
  it("fires due schedules, claims the next slot, marks ran", async () => {
    const claimed: Array<{ id: string; next: string }> = [];
    const invoked: string[] = [];
    const marked: string[] = [];
    const n = await runOnce(
      baseDeps({
        claimNextRun: async (id, next) => {
          claimed.push({ id, next: next.toISOString() });
        },
        invoke: async (s) => {
          invoked.push(s.id);
        },
        markRan: async (id) => {
          marked.push(id);
        },
      }),
    );
    expect(n).toBe(1);
    expect(invoked).toEqual(["1"]);
    expect(marked).toEqual(["1"]);
    // claimed BEFORE the run, next hour after now
    expect(claimed[0].next).toBe("2026-06-15T09:00:00.000Z");
  });

  it("skips invocation when the daily cap is reached", async () => {
    const invoked: string[] = [];
    const n = await runOnce(
      baseDeps({
        scheduledRunsSince: async () => 500,
        invoke: async (s) => {
          invoked.push(s.id);
        },
      }),
    );
    expect(n).toBe(0);
    expect(invoked).toEqual([]);
  });

  it("continues after one schedule's run throws", async () => {
    const invoked: string[] = [];
    const n = await runOnce(
      baseDeps({
        dueSchedules: async () => [row({ id: "1" }), row({ id: "2" })],
        invoke: async (s) => {
          invoked.push(s.id);
          if (s.id === "1") throw new Error("boom");
        },
      }),
    );
    expect(invoked).toEqual(["1", "2"]); // both attempted
    expect(n).toBe(1); // only id 2 counted as ran
  });
});
