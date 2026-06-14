import { describe, it, expect, vi, beforeEach } from "vitest";

const query = vi.fn();
vi.mock("../lib/db", () => ({ getPool: () => ({ query }) }));

import { listRuns } from "../lib/runs";

beforeEach(() => query.mockReset());

// createRun/finishRun now live in @agenomy/invoker (tested there). The web lib/runs.ts
// is a thin wrapper that binds listRuns to the app's pool.
describe("runs repository wrapper", () => {
  it("lists runs for an agent newest-first via the shared invoker query", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "7", agent_handle: "wizard" }], rowCount: 1 });
    const rows = await listRuns("wizard");
    expect(rows[0].id).toBe("7");
    expect(query.mock.calls[0][0]).toMatch(/WHERE agent_handle = \$1/i);
  });
});
