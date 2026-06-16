import { describe, it, expect, vi } from "vitest";

// vi.hoisted so the mock factory (hoisted above imports) can reference the fn safely
const { verify } = vi.hoisted(() => ({ verify: vi.fn(async () => true) }));

vi.mock("../lib/owner-auth", () => ({
  memoryPinMessage: () => "m",
  memoryDeleteMessage: () => "m",
  verifyOwnerSignedMessage: verify,
}));
vi.mock("../lib/db", () => ({
  getPool: () => ({
    query: async (t: string) => (t.includes("SELECT owner") ? { rowCount: 1, rows: [{ owner: "0xowner" }] } : { rowCount: 0, rows: [] }),
  }),
}));
vi.mock("../lib/memory-snapshot", () => ({ anchorMemory: async () => ({ cid: "bafy", hash: "h", entryCount: 1 }) }));
vi.mock("@agenomy/invoker", () => ({
  listMemory: async () => [{ id: "1", agent_handle: "wizard", kind: "pinned", content: "watch ETH", content_hash: "h", run_id: null, created_at: "t" }],
  getMemorySnapshot: async () => null,
  writePinnedMemory: async () => "1",
  memoryHash: (s: string) => "hash_" + s.length,
}));

const ctx = { params: Promise.resolve({ handle: "wizard" }) };

describe("memory route", () => {
  it("GET returns entries + snapshot", async () => {
    const { GET } = await import("../app/api/agents/[handle]/memory/route");
    const json = await (await GET(new Request("http://t/"), ctx)).json();
    expect(json.entries[0].content).toBe("watch ETH");
  });

  it("POST rejects empty content", async () => {
    const { POST } = await import("../app/api/agents/[handle]/memory/route");
    const res = await POST(new Request("http://t/", { method: "POST", body: JSON.stringify({ content: "" }) }), ctx);
    expect(res.status).toBe(400);
  });

  it("POST rejects a bad owner signature", async () => {
    verify.mockResolvedValueOnce(false);
    const { POST } = await import("../app/api/agents/[handle]/memory/route");
    const res = await POST(new Request("http://t/", { method: "POST", body: JSON.stringify({ content: "watch ETH", ts: 1, signature: "0x" }) }), ctx);
    expect(res.status).toBe(401);
  });

  it("POST writes when the signature is valid", async () => {
    verify.mockResolvedValueOnce(true);
    const { POST } = await import("../app/api/agents/[handle]/memory/route");
    const res = await POST(new Request("http://t/", { method: "POST", body: JSON.stringify({ content: "watch ETH", ts: 1, signature: "0x" }) }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
