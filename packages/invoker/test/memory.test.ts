import { describe, it, expect } from "vitest";
import {
  memoryHash, writeAutoMemory, writePinnedMemory, listMemory, countMemory,
  deleteMemory, buildMemoryContext, getMemorySnapshot, upsertMemorySnapshot,
} from "../src/memory";
import { fakePool } from "./fakePool";

describe("memory helpers", () => {
  it("memoryHash is deterministic sha256 hex", () => {
    expect(memoryHash("hello")).toBe(memoryHash("hello"));
    expect(memoryHash("hello")).toMatch(/^[0-9a-f]{64}$/);
    expect(memoryHash("a")).not.toBe(memoryHash("b"));
  });

  it("writeAutoMemory inserts a skill-prefixed truncated note then prunes", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await writeAutoMemory(pool, { agentHandle: "wizard", skillSlug: "base-gas-check", output: "x".repeat(400), runId: "7" });
    const insert = pool.calls.find((c) => c.text.includes("INSERT INTO memories"))!;
    expect(insert.text).toContain("'auto'");
    expect(String(insert.values![1]).startsWith("base-gas-check: ")).toBe(true);
    expect(String(insert.values![1]).length).toBe(240);
    expect(insert.values![3]).toBe("7");
    expect(pool.calls.some((c) => /DELETE FROM memories[\s\S]*NOT IN/i.test(c.text))).toBe(true);
  });

  it("writeAutoMemory is a no-op on empty output", async () => {
    const pool = fakePool(() => ({ rowCount: 0, rows: [] }));
    await writeAutoMemory(pool, { agentHandle: "wizard", skillSlug: "s", output: "  ", runId: "1" });
    expect(pool.calls.length).toBe(0);
  });

  it("writePinnedMemory inserts kind=pinned and returns the id", async () => {
    const pool = fakePool((t) => (t.includes("INSERT INTO memories") ? { rowCount: 1, rows: [{ id: 9 }] } : undefined));
    const id = await writePinnedMemory(pool, { agentHandle: "wizard", content: "watch ETH" });
    expect(id).toBe("9");
    expect(pool.calls[0].values).toEqual(["wizard", "watch ETH", memoryHash("watch ETH")]);
  });

  it("buildMemoryContext formats pinned + recent auto, empty when none", async () => {
    const empty = fakePool(() => ({ rowCount: 0, rows: [] }));
    expect(await buildMemoryContext(empty, "wizard")).toBe("");

    const pool = fakePool((t) => {
      if (t.includes("kind = 'pinned'")) return { rowCount: 1, rows: [{ content: "watch ETH" }] };
      if (t.includes("kind = 'auto'")) return { rowCount: 1, rows: [{ content: "base-gas-check: 0.006 gwei" }] };
      return undefined;
    });
    const ctx = await buildMemoryContext(pool, "wizard");
    expect(ctx).toContain("## Memory");
    expect(ctx).toContain("watch ETH");
    expect(ctx).toContain("base-gas-check: 0.006 gwei");
  });

  it("listMemory maps rows; deleteMemory + count issue scoped SQL", async () => {
    const pool = fakePool((t) => {
      if (t.includes("SELECT id, agent_handle")) return { rowCount: 1, rows: [{ id: 3, agent_handle: "wizard", kind: "pinned", content: "c", content_hash: "h", run_id: null, created_at: "t" }] };
      if (t.includes("COUNT(*)")) return { rowCount: 1, rows: [{ n: 5 }] };
      return undefined;
    });
    const rows = await listMemory(pool, "wizard");
    expect(rows[0]).toEqual({ id: "3", agent_handle: "wizard", kind: "pinned", content: "c", content_hash: "h", run_id: null, created_at: "t" });
    expect(await countMemory(pool, "wizard")).toBe(5);
    await deleteMemory(pool, "wizard", "3");
    const del = pool.calls.find((c) => c.text.includes("DELETE FROM memories WHERE agent_handle = $1 AND id = $2"))!;
    expect(del.values).toEqual(["wizard", "3"]);
  });

  it("snapshot pointer get/upsert", async () => {
    const get = fakePool((t) => (t.includes("FROM memory_snapshots") ? { rowCount: 1, rows: [{ cid: "bafy", hash: "h", entry_count: 4, updated_at: "t" }] } : undefined));
    expect(await getMemorySnapshot(get, "wizard")).toEqual({ cid: "bafy", hash: "h", entry_count: 4, updated_at: "t" });
    const up = fakePool(() => ({ rowCount: 1, rows: [] }));
    await upsertMemorySnapshot(up, "wizard", { cid: "bafy", hash: "h", entryCount: 4 });
    expect(up.calls[0].text).toMatch(/INSERT INTO memory_snapshots[\s\S]*ON CONFLICT/i);
    expect(up.calls[0].values).toEqual(["wizard", "bafy", "h", 4]);
  });
});
