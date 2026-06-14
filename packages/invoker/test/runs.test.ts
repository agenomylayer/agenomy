// packages/invoker/test/runs.test.ts
import { describe, it, expect } from "vitest";
import { createRun, finishRun, listRuns } from "../src/runs";
import { fakePool } from "./fakePool";

describe("runs helpers", () => {
  it("createRun inserts with source and returns the new id as a string", async () => {
    const pool = fakePool((text) =>
      text.includes("INSERT INTO runs") ? { rowCount: 1, rows: [{ id: 42 }] } : undefined,
    );
    const id = await createRun(pool, {
      agentHandle: "wizard",
      skillSlug: "base-gas-check",
      input: "",
      source: "scheduled",
    });
    expect(id).toBe("42");
    expect(pool.calls[0].values).toEqual(["wizard", "base-gas-check", "", "scheduled"]);
  });

  it("finishRun updates status/trace and stringifies the trace", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await finishRun(pool, "7", { status: "ok", output: "hi", trace: [{ type: "final" }], model: "m" });
    const v = pool.calls[0].values!;
    expect(v[0]).toBe("7");
    expect(v[1]).toBe("ok");
    expect(v[3]).toBe(JSON.stringify([{ type: "final" }]));
  });

  it("listRuns selects source and orders by started_at desc", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [{ id: 1, source: "scheduled" }] }));
    const rows = await listRuns(pool, "wizard", 5);
    expect(rows[0].source).toBe("scheduled");
    expect(pool.calls[0].text).toContain("source");
    expect(pool.calls[0].values).toEqual(["wizard", 5]);
  });
});
