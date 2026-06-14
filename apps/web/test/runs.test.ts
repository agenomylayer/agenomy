import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("../lib/db", () => ({ getPool: () => ({ query }) }));

import { createRun, finishRun, listRuns } from "../lib/runs";

beforeEach(() => query.mockReset());

describe("runs repository", () => {
  it("inserts a running run and returns its id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "7" }], rowCount: 1 });
    const id = await createRun({ agentHandle: "wizard", skillSlug: "token-info", input: "0xabc" });
    expect(id).toBe("7");
    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO runs/i);
  });
  it("finishes a run with output + status", async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    await finishRun("7", {
      status: "ok",
      output: "done",
      trace: [],
      model: "claude",
      tokensIn: 10,
      tokensOut: 20,
    });
    expect(query.mock.calls[0][0]).toMatch(/UPDATE runs/i);
  });
  it("lists runs for an agent newest-first", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "7", agent_handle: "wizard" }], rowCount: 1 });
    const rows = await listRuns("wizard");
    expect(rows[0].id).toBe("7");
    expect(query.mock.calls[0][0]).toMatch(/WHERE agent_handle = \$1/i);
  });
});
