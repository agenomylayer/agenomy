// packages/invoker/test/schedules.test.ts
import { describe, it, expect } from "vitest";
import {
  createSchedule,
  listSchedules,
  countSchedules,
  dueSchedules,
  claimNextRun,
  markRan,
  countScheduledRunsSince,
} from "../src/schedules";
import { fakePool } from "./fakePool";

describe("schedules helpers", () => {
  it("createSchedule computes next_run_at from cron and returns id", async () => {
    const pool = fakePool((text) =>
      text.includes("INSERT INTO schedules") ? { rowCount: 1, rows: [{ id: 9 }] } : undefined,
    );
    const id = await createSchedule(
      pool,
      { agentHandle: "gas", skillSlug: "base-gas-check", input: "", cron: "0 9 * * *" },
      new Date("2026-06-15T08:30:00.000Z"),
    );
    expect(id).toBe("9");
    // values: handle, slug, input, cron, next_run_at(iso)
    expect(pool.calls[0].values!.slice(0, 4)).toEqual(["gas", "base-gas-check", "", "0 9 * * *"]);
    expect(pool.calls[0].values![4]).toBe("2026-06-15T09:00:00.000Z");
  });

  it("dueSchedules filters enabled + next_run_at <= now", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [{ id: 1, agent_handle: "gas" }] }));
    const now = new Date("2026-06-15T09:00:00.000Z");
    const rows = await dueSchedules(pool, now);
    expect(rows).toHaveLength(1);
    expect(pool.calls[0].text).toContain("enabled");
    expect(pool.calls[0].values).toEqual(["2026-06-15T09:00:00.000Z"]);
  });

  it("countSchedules returns the integer count", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [{ n: 3 }] }));
    expect(await countSchedules(pool, "gas")).toBe(3);
  });

  it("countScheduledRunsSince counts scheduled runs after a time", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [{ n: 12 }] }));
    const since = new Date("2026-06-14T09:00:00.000Z");
    expect(await countScheduledRunsSince(pool, since)).toBe(12);
    expect(pool.calls[0].text).toContain("source = 'scheduled'");
  });

  it("claimNextRun and markRan update by id", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await claimNextRun(pool, "1", new Date("2026-06-16T09:00:00.000Z"));
    await markRan(pool, "1", new Date("2026-06-15T09:00:05.000Z"));
    expect(pool.calls[0].values).toEqual(["1", "2026-06-16T09:00:00.000Z"]);
    expect(pool.calls[1].values).toEqual(["1", "2026-06-15T09:00:05.000Z"]);
  });

  it("listSchedules orders by created_at desc", async () => {
    const pool = fakePool(() => ({ rowCount: 0, rows: [] }));
    await listSchedules(pool, "gas");
    expect(pool.calls[0].text).toContain("ORDER BY created_at DESC");
    expect(pool.calls[0].values).toEqual(["gas"]);
  });
});
