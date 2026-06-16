# Slice 5: Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** give every agent persistent memory that the runtime reads into every run (auto notes from runs + owner-pinned facts), with a content-hash + IPFS-snapshot verifiable artifact.

**Architecture:** A new `memories` + `memory_snapshots` table; a pure-DB `@agenomy/invoker` `memory.ts` module (hash + CRUD + prompt-context builder + snapshot pointer); `runAgent` gains a `memory` param injected into the system prompt; `invokeSkillRun` reads memory before the run and writes an auto note after a successful run; a web `anchorMemory` helper pins the snapshot to IPFS (reusing the Pinata path); owner-signed web API routes; a console-styled `MemoryPanel`.

**Tech Stack:** TypeScript, Postgres (via the `Queryable` interface), Node `crypto` sha256, vitest + `fakePool`, Next.js App Router, viem `verifyMessage`, Pinata (`pinJSON`).

**Spec:** `docs/superpowers/specs/2026-06-16-slice5-memory-design.md`

**Test commands:** `pnpm --filter @agenomy/invoker test`, `pnpm --filter @agenomy/runtime test`, `pnpm --filter @agenomy/web test`, `pnpm --filter @agenomy/web build`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `migrations/005_memory.sql` (create) | `memories` + `memory_snapshots` tables |
| `packages/invoker/src/memory.ts` (create) | hash, write/list/delete, prune, `buildMemoryContext`, snapshot pointer |
| `packages/invoker/src/index.ts` (modify) | export memory module |
| `packages/invoker/test/memory.test.ts` (create) | unit tests via `fakePool` |
| `packages/runtime/src/agent.ts` (modify) | `memory?` param → system prompt |
| `packages/runtime/test/agent.test.ts` (modify) | memory-injection assertions |
| `packages/invoker/src/invoke.ts` (modify) | read memory before run, write auto after run |
| `packages/invoker/test/invoke.test.ts` (modify) | assert memory read + auto write |
| `apps/web/lib/owner-auth.ts` (modify) | generic `verifyOwnerSignedMessage` + memory messages |
| `apps/web/lib/memory-snapshot.ts` (create) | `anchorMemory` (pin to IPFS, upsert pointer) |
| `apps/web/app/api/agents/[handle]/memory/route.ts` (create) | GET list+snapshot, POST owner-pin |
| `apps/web/app/api/agents/[handle]/memory/[id]/route.ts` (create) | DELETE owner |
| `apps/web/app/api/agents/[handle]/memory/anchor/route.ts` (create) | POST owner re-anchor |
| `apps/web/app/agents/[handle]/MemoryPanel.tsx` (create) | console-styled panel |
| `apps/web/app/agents/[handle]/AgentProfile.tsx` (modify) | mount MemoryPanel |
| `apps/web/app/agents/[handle]/AgentRail.tsx` (modify) | drop Memory `soon` tag |
| `apps/web/app/globals.css` (modify) | a few `ac-mem*` classes |

---

### Task 1: Migration

**Files:**
- Create: `migrations/005_memory.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 005_memory.sql — Slice 5: agent memory
CREATE TABLE IF NOT EXISTS memories (
  id            BIGSERIAL PRIMARY KEY,
  agent_handle  TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'auto',   -- 'auto' | 'pinned'
  content       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  run_id        BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_agent_idx ON memories (agent_handle, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_snapshots (
  agent_handle  TEXT PRIMARY KEY,
  cid           TEXT NOT NULL,
  hash          TEXT NOT NULL,
  entry_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Commit**

```bash
git add migrations/005_memory.sql
git commit -m "feat(db): 005_memory migration (memories + memory_snapshots)"
```

(The migration is applied to the live DB in Task 9.)

---

### Task 2: Invoker memory module

**Files:**
- Create: `packages/invoker/src/memory.ts`
- Modify: `packages/invoker/src/index.ts`
- Test: `packages/invoker/test/memory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/invoker/test/memory.test.ts
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
    expect(insert.values![1]).toBe("auto");
    expect(String(insert.values![2]).startsWith("base-gas-check: ")).toBe(true);
    expect(String(insert.values![2]).length).toBe(240);
    expect(insert.values![4]).toBe("7");
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @agenomy/invoker test memory`
Expected: FAIL (cannot import from `../src/memory`).

- [ ] **Step 3: Implement `packages/invoker/src/memory.ts`**

```ts
import { createHash } from "node:crypto";
import type { Queryable } from "./db";

export type MemoryKind = "auto" | "pinned";

export interface MemoryRow {
  id: string;
  agent_handle: string;
  kind: MemoryKind;
  content: string;
  content_hash: string;
  run_id: string | null;
  created_at: string;
}

export interface MemorySnapshot {
  cid: string;
  hash: string;
  entry_count: number;
  updated_at: string;
}

const AUTO_CAP = 50;
const AUTO_TRUNC = 240;

export function memoryHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function writeAutoMemory(
  pool: Queryable,
  p: { agentHandle: string; skillSlug: string; output: string; runId: string },
): Promise<void> {
  const text = p.output.trim();
  if (!text) return;
  const note = `${p.skillSlug}: ${text}`.slice(0, AUTO_TRUNC);
  await pool.query(
    `INSERT INTO memories (agent_handle, kind, content, content_hash, run_id) VALUES ($1, 'auto', $2, $3, $4)`,
    [p.agentHandle, note, memoryHash(note), p.runId],
  );
  await pool.query(
    `DELETE FROM memories WHERE agent_handle = $1 AND kind = 'auto' AND id NOT IN (
       SELECT id FROM memories WHERE agent_handle = $1 AND kind = 'auto' ORDER BY created_at DESC, id DESC LIMIT $2
     )`,
    [p.agentHandle, AUTO_CAP],
  );
}

export async function writePinnedMemory(pool: Queryable, p: { agentHandle: string; content: string }): Promise<string> {
  const content = p.content.trim();
  const res = await pool.query(
    `INSERT INTO memories (agent_handle, kind, content, content_hash) VALUES ($1, 'pinned', $2, $3) RETURNING id`,
    [p.agentHandle, content, memoryHash(content)],
  );
  return String(res.rows[0].id);
}

export async function listMemory(pool: Queryable, handle: string, limit = 100): Promise<MemoryRow[]> {
  const res = await pool.query(
    `SELECT id, agent_handle, kind, content, content_hash, run_id, created_at
     FROM memories WHERE agent_handle = $1
     ORDER BY (kind = 'pinned') DESC, created_at DESC, id DESC LIMIT $2`,
    [handle, limit],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    agent_handle: String(r.agent_handle),
    kind: r.kind as MemoryKind,
    content: String(r.content),
    content_hash: String(r.content_hash),
    run_id: r.run_id == null ? null : String(r.run_id),
    created_at: String(r.created_at),
  }));
}

export async function countMemory(pool: Queryable, handle: string): Promise<number> {
  const res = await pool.query(`SELECT COUNT(*)::int AS n FROM memories WHERE agent_handle = $1`, [handle]);
  return Number(res.rows[0]?.n ?? 0);
}

export async function deleteMemory(pool: Queryable, handle: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM memories WHERE agent_handle = $1 AND id = $2`, [handle, id]);
}

export async function buildMemoryContext(
  pool: Queryable,
  handle: string,
  opts: { autoLimit?: number; budget?: number } = {},
): Promise<string> {
  const autoLimit = opts.autoLimit ?? 8;
  const budget = opts.budget ?? 1500;
  const pinnedRes = await pool.query(
    `SELECT content FROM memories WHERE agent_handle = $1 AND kind = 'pinned' ORDER BY created_at ASC LIMIT 10`,
    [handle],
  );
  const autoRes = await pool.query(
    `SELECT content FROM memories WHERE agent_handle = $1 AND kind = 'auto' ORDER BY created_at DESC, id DESC LIMIT $2`,
    [handle, autoLimit],
  );
  const pinned = pinnedRes.rows.map((r) => String(r.content));
  const auto = autoRes.rows.map((r) => String(r.content));
  if (pinned.length === 0 && auto.length === 0) return "";
  let out = "## Memory\n";
  if (pinned.length) out += "What your owner pinned (treat as always true):\n" + pinned.map((c) => `- ${c}`).join("\n") + "\n";
  if (auto.length) out += "Recent activity (most recent first):\n" + auto.map((c) => `- ${c}`).join("\n") + "\n";
  return out.slice(0, budget).trim();
}

export async function getMemorySnapshot(pool: Queryable, handle: string): Promise<MemorySnapshot | null> {
  const res = await pool.query(
    `SELECT cid, hash, entry_count, updated_at FROM memory_snapshots WHERE agent_handle = $1 LIMIT 1`,
    [handle],
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const r = res.rows[0];
  return { cid: String(r.cid), hash: String(r.hash), entry_count: Number(r.entry_count), updated_at: String(r.updated_at) };
}

export async function upsertMemorySnapshot(
  pool: Queryable,
  handle: string,
  s: { cid: string; hash: string; entryCount: number },
): Promise<void> {
  await pool.query(
    `INSERT INTO memory_snapshots (agent_handle, cid, hash, entry_count, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (agent_handle) DO UPDATE SET cid = EXCLUDED.cid, hash = EXCLUDED.hash, entry_count = EXCLUDED.entry_count, updated_at = now()`,
    [handle, s.cid, s.hash, s.entryCount],
  );
}
```

- [ ] **Step 4: Export from `packages/invoker/src/index.ts`** — add the line:

```ts
export * from "./memory";
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm --filter @agenomy/invoker test`
Expected: PASS (all, including memory).

- [ ] **Step 6: Commit**

```bash
git add packages/invoker/src/memory.ts packages/invoker/src/index.ts packages/invoker/test/memory.test.ts
git commit -m "feat(invoker): memory module (hash, write/list/delete, context builder, snapshot pointer)"
```

---

### Task 3: Runtime memory injection

**Files:**
- Modify: `packages/runtime/src/agent.ts`
- Test: `packages/runtime/test/agent.test.ts`

- [ ] **Step 1: Add the failing test** (append to the existing describe block; if a `chat` mock helper already exists in the file, reuse it)

```ts
it("injects the memory block into the system prompt when provided", async () => {
  const seen: { system?: string } = {};
  const fetchFn = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    seen.system = body.messages.find((m: { role: string }) => m.role === "system").content;
    return new Response(JSON.stringify({ choices: [{ message: { content: "done" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;

  const skill = { slug: "s", name: "S", description: "", category: "c", tools: [], schedule: null, inputs: "", prompt: "You are {{persona}}." };
  const { makeRegistry, onchainRead, marketData } = await import("../src/index");
  await runAgent({
    skill, persona: "Scout", input: "go", memory: "## Memory\n- watch ETH",
    registry: makeRegistry([onchainRead, marketData]),
    provider: { baseUrl: "http://t/v1", apiKey: "k", model: "m" },
    toolCtx: { rpcUrl: "http://r", fetch }, fetchFn,
  });
  expect(seen.system).toContain("## Memory");
  expect(seen.system).toContain("watch ETH");
});
```

(Import `runAgent` at top if not already imported in the test file.)

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @agenomy/runtime test agent`
Expected: FAIL (memory not in system prompt; `memory` not a known input).

- [ ] **Step 3: Implement** — in `packages/runtime/src/agent.ts`:

Add to `RunAgentInput` (after `maxSteps?: number;`):
```ts
  memory?: string; // persistent memory block injected into the system prompt
```

Change the `system` construction (line 45) from `const` to `let` and append the memory block:
```ts
  let system = inp.skill.prompt.replace(/\{\{persona\}\}/g, inp.persona || "an autonomous agent");
  if (inp.memory && inp.memory.trim()) {
    system += `\n\n${inp.memory.trim()}\n\nUse this memory when relevant. Do not invent memories you do not have.`;
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @agenomy/runtime test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/agent.ts packages/runtime/test/agent.test.ts
git commit -m "feat(runtime): inject agent memory into the system prompt"
```

---

### Task 4: Wire memory into the run path

**Files:**
- Modify: `packages/invoker/src/invoke.ts`
- Test: `packages/invoker/test/invoke.test.ts`

- [ ] **Step 1: Add the failing test** (new `it` in invoke.test.ts)

```ts
it("reads memory before the run and writes an auto note after a successful run", async () => {
  const pool = fakePool((text) => {
    if (text.includes("SELECT persona")) return { rowCount: 1, rows: [{ persona: { displayName: "Gas Watcher" } }] };
    if (text.includes("kind = 'pinned'")) return { rowCount: 1, rows: [{ content: "watch ETH" }] };
    if (text.includes("INSERT INTO runs")) return { rowCount: 1, rows: [{ id: 7 }] };
    return undefined;
  });
  await invokeSkillRun({ pool, handle: "gas", skillSlug: "base-gas-check", input: "", source: "manual", env, fetchFn: mockLLM() });
  expect(pool.calls.some((c) => c.text.includes("kind = 'pinned'"))).toBe(true);   // read
  const ins = pool.calls.find((c) => c.text.includes("INSERT INTO memories"));      // write auto
  expect(ins).toBeTruthy();
  expect(String(ins!.values![2]).startsWith("base-gas-check: ")).toBe(true);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @agenomy/invoker test invoke`
Expected: FAIL (no memory read/write yet).

- [ ] **Step 3: Implement** — in `packages/invoker/src/invoke.ts`:

Add import:
```ts
import { buildMemoryContext, writeAutoMemory } from "./memory";
```
After `const persona = ...` (line 54), add:
```ts
  const memory = await buildMemoryContext(pool, handle);
```
Add `memory,` to the `runAgent({ ... })` call object. After the `finishRun(...)` call (line 83), add:
```ts
  if (result.status === "ok") {
    try {
      await writeAutoMemory(pool, { agentHandle: handle, skillSlug, output: result.output, runId });
    } catch {
      /* memory must never fail a run */
    }
  }
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @agenomy/invoker test`
Expected: PASS (all invoke + memory tests).

- [ ] **Step 5: Commit**

```bash
git add packages/invoker/src/invoke.ts packages/invoker/test/invoke.test.ts
git commit -m "feat(invoker): read memory into runs + write auto memory after a successful run"
```

---

### Task 5: Web owner-auth — generic verify + memory messages

**Files:**
- Modify: `apps/web/lib/owner-auth.ts`

- [ ] **Step 1: Implement** (no separate test file; covered by the route tests in Task 7). Replace the file with:

```ts
import { verifyMessage } from "viem";

const MAX_AGE_SECONDS = 600; // 10 minutes

export function priceMessage(handle: string, priceAtomic: bigint, ts: number): string {
  return `Agenomy: set price for ${handle} to ${priceAtomic.toString()} (USDC atomic) at ${ts}`;
}
export function memoryPinMessage(handle: string, contentHash: string, ts: number): string {
  return `Agenomy: pin memory for ${handle} :: ${contentHash} :: ${ts}`;
}
export function memoryDeleteMessage(handle: string, id: string, ts: number): string {
  return `Agenomy: delete memory ${id} for ${handle} at ${ts}`;
}

export async function verifyOwnerSignedMessage(opts: {
  message: string;
  signature: `0x${string}`;
  owner: string;
  ts: number;
  now: number;
}): Promise<boolean> {
  if (!Number.isFinite(opts.ts)) return false;
  if (Math.abs(opts.now - opts.ts) > MAX_AGE_SECONDS) return false;
  try {
    return await verifyMessage({ address: opts.owner as `0x${string}`, message: opts.message, signature: opts.signature });
  } catch {
    return false;
  }
}

export async function verifyOwnerSig(opts: {
  handle: string;
  priceAtomic: bigint;
  ts: number;
  signature: `0x${string}`;
  owner: string;
  now: number;
}): Promise<boolean> {
  return verifyOwnerSignedMessage({
    message: priceMessage(opts.handle, opts.priceAtomic, opts.ts),
    signature: opts.signature,
    owner: opts.owner,
    ts: opts.ts,
    now: opts.now,
  });
}
```

- [ ] **Step 2: Verify existing pricing tests still pass**

Run: `pnpm --filter @agenomy/web test owner-auth` (and pricing route test, if present)
Expected: PASS (verifyOwnerSig unchanged behavior).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/owner-auth.ts
git commit -m "feat(web): generic owner-signed-message verify + memory pin/delete messages"
```

---

### Task 6: Web IPFS snapshot anchor

**Files:**
- Create: `apps/web/lib/memory-snapshot.ts`

- [ ] **Step 1: Implement**

```ts
import { createHash } from "node:crypto";
import { getPool } from "./db";
import { listMemory, upsertMemorySnapshot } from "@agenomy/invoker";
import { pinJSON } from "./pinata";

/** Build the agent's full memory snapshot, pin it to IPFS, and record the pointer. */
export async function anchorMemory(handle: string): Promise<{ cid: string; hash: string; entryCount: number }> {
  const pool = getPool();
  const entries = await listMemory(pool, handle, 1000);
  const snapshot = {
    handle,
    count: entries.length,
    entries: entries.map((e) => ({ id: e.id, kind: e.kind, content: e.content, content_hash: e.content_hash, created_at: e.created_at })),
  };
  const hash = createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not configured");
  const cid = await pinJSON(snapshot, jwt);
  await upsertMemorySnapshot(pool, handle, { cid, hash, entryCount: entries.length });
  return { cid, hash, entryCount: entries.length };
}
```

- [ ] **Step 2: Typecheck via build later (Task 8). Commit**

```bash
git add apps/web/lib/memory-snapshot.ts
git commit -m "feat(web): anchorMemory pins the memory snapshot to IPFS"
```

---

### Task 7: Web API routes

**Files:**
- Create: `apps/web/app/api/agents/[handle]/memory/route.ts`
- Create: `apps/web/app/api/agents/[handle]/memory/[id]/route.ts`
- Create: `apps/web/app/api/agents/[handle]/memory/anchor/route.ts`
- Test: `apps/web/test/memory.route.test.ts`

- [ ] **Step 1: Write the failing test** (mirror the pricing route test style; mock `@agenomy/invoker` + `memory-snapshot` + `owner-auth`)

```ts
// apps/web/test/memory.route.test.ts
import { describe, it, expect, vi } from "vitest";

// vi.hoisted so the mock factory (hoisted above imports) can reference the fn safely
const { verify } = vi.hoisted(() => ({ verify: vi.fn(async () => true) }));

vi.mock("../lib/owner-auth", () => ({
  memoryPinMessage: () => "m",
  memoryDeleteMessage: () => "m",
  verifyOwnerSignedMessage: verify,
}));
vi.mock("../lib/db", () => ({ getPool: () => ({ query: async (t: string) => (t.includes("SELECT owner") ? { rowCount: 1, rows: [{ owner: "0xowner" }] } : { rowCount: 0, rows: [] }) }) }));
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
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm --filter @agenomy/web test memory.route`
Expected: FAIL (routes don't exist).

- [ ] **Step 3: Implement `memory/route.ts`**

```ts
import { NextResponse } from "next/server";
import { listMemory, writePinnedMemory, getMemorySnapshot, memoryHash } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";
import { memoryPinMessage, verifyOwnerSignedMessage } from "../../../../../lib/owner-auth";
import { anchorMemory } from "../../../../../lib/memory-snapshot";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const pool = getPool();
  const [entries, snapshot] = await Promise.all([listMemory(pool, handle, 200), getMemorySnapshot(pool, handle)]);
  return NextResponse.json({ entries, snapshot });
}

export async function POST(request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { content?: string; ts?: number; signature?: string };
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: "content too long (max 500)" }, { status: 400 });
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSignedMessage({ message: memoryPinMessage(handle, memoryHash(content), ts), signature, owner, ts, now: Math.floor(Date.now() / 1000) });
  if (!ok) return NextResponse.json({ error: "not authorized (owner signature required)" }, { status: 401 });

  const id = await writePinnedMemory(pool, { agentHandle: handle, content });
  let snapshot = null;
  try { snapshot = await anchorMemory(handle); } catch { /* pin failure shouldn't block the write */ }
  return NextResponse.json({ ok: true, id, snapshot });
}
```

- [ ] **Step 4: Implement `memory/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { deleteMemory } from "@agenomy/invoker";
import { getPool } from "../../../../../../lib/db";
import { memoryDeleteMessage, verifyOwnerSignedMessage } from "../../../../../../lib/owner-auth";
import { anchorMemory } from "../../../../../../lib/memory-snapshot";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ handle: string; id: string }> }): Promise<Response> {
  const { handle, id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { ts?: number; signature?: string };
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSignedMessage({ message: memoryDeleteMessage(handle, id, ts), signature, owner, ts, now: Math.floor(Date.now() / 1000) });
  if (!ok) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  await deleteMemory(pool, handle, id);
  let snapshot = null;
  try { snapshot = await anchorMemory(handle); } catch { /* ignore */ }
  return NextResponse.json({ ok: true, snapshot });
}
```

- [ ] **Step 5: Implement `memory/anchor/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getPool } from "../../../../../../lib/db";
import { memoryPinMessage, verifyOwnerSignedMessage } from "../../../../../../lib/owner-auth";
import { anchorMemory } from "../../../../../../lib/memory-snapshot";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { ts?: number; signature?: string };
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSignedMessage({ message: memoryPinMessage(handle, "anchor", ts), signature, owner, ts, now: Math.floor(Date.now() / 1000) });
  if (!ok) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  const snapshot = await anchorMemory(handle);
  return NextResponse.json({ ok: true, snapshot });
}
```

- [ ] **Step 6: Run, verify pass**

Run: `pnpm --filter @agenomy/web test memory.route`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/agents/[handle]/memory apps/web/test/memory.route.test.ts
git commit -m "feat(web): memory API routes (list/pin/delete/anchor, owner-signed)"
```

---

### Task 8: MemoryPanel UI + integration

**Files:**
- Create: `apps/web/app/agents/[handle]/MemoryPanel.tsx`
- Modify: `apps/web/app/agents/[handle]/AgentProfile.tsx`
- Modify: `apps/web/app/agents/[handle]/AgentRail.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Add CSS** — append to `apps/web/app/globals.css` (after the `ac-card-primary` rule):

```css
/* memory panel */
.ac-memrow { display: flex; align-items: flex-start; gap: 12px; padding: 13px 16px; background: var(--panel-2); border-bottom: 1px solid var(--line-soft); }
.ac-memrow:last-child { border-bottom: none; }
.ac-memrow .body { min-width: 0; flex: 1; }
.ac-memtext { font-size: 13.5px; color: var(--ink); line-height: 1.5; word-break: break-word; }
.ac-memtime { font-family: var(--mono); font-size: 11px; color: var(--ink-ghost); margin-top: 3px; }
.ac-memkind { font-family: var(--mono); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; flex: 0 0 auto; }
.ac-memkind.pinned { color: var(--accent-deep); background: var(--accent-soft); border: 1px solid rgba(217,67,15,.26); }
.ac-memkind.auto { color: var(--ink-mute); background: var(--panel-3); border: 1px solid var(--line); }
.ac-memsnap { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-family: var(--mono); font-size: 12px; color: var(--ink-mute); margin-bottom: 14px; padding: 11px 14px; background: var(--code-bg); border: 1px solid var(--line-soft); border-radius: var(--r-md); }
```

- [ ] **Step 2: Implement `MemoryPanel.tsx`** (console-styled; owner add/delete via signed messages; shows snapshot + honesty note)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface Entry { id: string; kind: "auto" | "pinned"; content: string; content_hash: string; created_at: string; }
interface Snapshot { cid: string; hash: string; entry_count: number; updated_at: string; }

const ChipIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z" /><path d="M10 9.5h4M10 13h4" /></svg>
);
const fmt = (s: string) => { try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return s; } };
const sha256Hex = async (s: string) => { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); };

export function MemoryPanel({ handle, owner, ipfsGateway }: { handle: string; owner: string; ipfsGateway: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const isOwner = Boolean(address && address.toLowerCase() === owner.toLowerCase());

  function load() {
    fetch(`/api/agents/${handle}/memory`).then((r) => r.json()).then((d) => { setEntries(d.entries ?? []); setSnapshot(d.snapshot ?? null); }).catch(() => {});
  }
  useEffect(load, [handle]);

  async function pin() {
    const content = note.trim();
    if (!content) return;
    setBusy(true); setMsg("");
    try {
      const ts = Math.floor(Date.now() / 1000);
      const hash = await sha256Hex(content);
      const signature = await signMessageAsync({ message: `Agenomy: pin memory for ${handle} :: ${hash} :: ${ts}` });
      const res = await fetch(`/api/agents/${handle}/memory`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, ts, signature }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error ?? "could not pin"); }
      else { setNote(""); load(); }
    } catch { setMsg("signature cancelled"); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setMsg("");
    try {
      const ts = Math.floor(Date.now() / 1000);
      const signature = await signMessageAsync({ message: `Agenomy: delete memory ${id} for ${handle} at ${ts}` });
      const res = await fetch(`/api/agents/${handle}/memory/${id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ ts, signature }) });
      if (res.ok) load(); else setMsg("could not delete");
    } catch { setMsg("signature cancelled"); } finally { setBusy(false); }
  }

  return (
    <section className="ac-card" id="memory">
      <div className="ac-sechead">
        <div className="ac-sectitle">
          <span className="ac-secic">{ChipIc}</span>
          <h2>Memory</h2>
        </div>
        <span className="ac-secsub">{entries.length} {entries.length === 1 ? "entry" : "entries"} · verifiable</span>
      </div>

      {snapshot && (
        <div className="ac-memsnap">
          anchored to IPFS ·{" "}
          <a className="link-accent" href={`https://${ipfsGateway}/ipfs/${snapshot.cid}`} target="_blank" rel="noreferrer">{snapshot.cid.slice(0, 10)}…</a>
          {" "}· {snapshot.entry_count} entries · on-chain attestation comes with mainnet
        </div>
      )}

      {entries.length === 0 ? (
        <p className="muted-note">No memories yet. This agent starts remembering after its first run, and you can pin durable facts below.</p>
      ) : (
        <div className="ac-feed">
          {entries.map((e) => (
            <div className="ac-memrow" key={e.id}>
              <span className={`ac-memkind ${e.kind}`}>{e.kind}</span>
              <div className="body">
                <div className="ac-memtext">{e.content}</div>
                <div className="ac-memtime">{fmt(e.created_at)}</div>
              </div>
              {isOwner && <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => remove(e.id)}>delete</button>}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="owner-box" style={{ marginTop: "18px" }}>
          <span className="owner-tag">Owner</span>
          <p className="muted-note" style={{ margin: "0 0 10px" }}>Pin a durable fact the agent should always know. You sign with your owner wallet.</p>
          <div className="form-col">
            <textarea className="field" style={{ minHeight: "64px", resize: "vertical" }} placeholder="e.g. watch ETH, WETH, USDC; alert if gas > 5 gwei" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <button className="btn btn-primary" disabled={busy || !note.trim()} onClick={pin} style={{ alignSelf: "flex-start" }}>{busy ? "Signing…" : "Pin to memory"}</button>
          </div>
          {msg && <p className="muted-note" style={{ margin: "10px 0 0" }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Mount it** — in `AgentProfile.tsx`:

Add import: `import { MemoryPanel } from "./MemoryPanel";`
Replace the placeholder `<section id="memory"> ... </section>` block with:
```tsx
          <MemoryPanel handle={agent.handle} owner={agent.owner} ipfsGateway={ipfsGateway} />
```

- [ ] **Step 4: Drop the `soon` tag** — in `AgentRail.tsx`, change the memory NAV entry from `{ id: "memory", label: "Memory", tag: "soon" }` to `{ id: "memory", label: "Memory" }`.

- [ ] **Step 5: Add the panel test** — `apps/web/app/agents/[handle]/MemoryPanel.test.tsx` (mock wagmi + fetch):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
vi.mock("wagmi", () => ({ useAccount: () => ({ address: undefined }), useSignMessage: () => ({ signMessageAsync: async () => "0x" }) }));
import { MemoryPanel } from "./MemoryPanel";

beforeEach(() => {
  global.fetch = vi.fn(async () => new Response(JSON.stringify({ entries: [{ id: "1", kind: "pinned", content: "watch ETH", content_hash: "h", created_at: "2026-06-16T00:00:00Z" }], snapshot: { cid: "bafy0000000000", hash: "h", entry_count: 1, updated_at: "t" } }), { status: 200 })) as unknown as typeof fetch;
});

describe("MemoryPanel", () => {
  it("renders entries and the IPFS snapshot", async () => {
    render(<MemoryPanel handle="wizard" owner="0xowner" ipfsGateway="gateway.pinata.cloud" />);
    await waitFor(() => expect(screen.getByText("watch ETH")).toBeInTheDocument());
    expect(screen.getByText(/anchored to IPFS/i)).toBeInTheDocument();
    expect(screen.getByText(/pinned/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Build + test**

Run: `pnpm --filter @agenomy/web build && pnpm --filter @agenomy/web test`
Expected: build OK; all web tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/agents/[handle]/MemoryPanel.tsx apps/web/app/agents/[handle]/MemoryPanel.test.tsx apps/web/app/agents/[handle]/AgentProfile.tsx apps/web/app/agents/[handle]/AgentRail.tsx apps/web/app/globals.css
git commit -m "feat(web): MemoryPanel (console-styled) wired into the agent console; rail Memory no longer 'soon'"
```

---

### Task 9: Deploy + apply migration + verify

**Files:** none (ops)

- [ ] **Step 1: Full green check**

Run: `pnpm --filter @agenomy/invoker test && pnpm --filter @agenomy/runtime test && pnpm --filter @agenomy/web test && pnpm --filter @agenomy/web build`
Expected: all green.

- [ ] **Step 2: Push**

```bash
git push origin slice-1-agent-identity:main
```

- [ ] **Step 3: Apply migration on the VPS Postgres + deploy**

Ship the repo (git archive → pscp → `tar -xf`), then apply the migration inside the postgres container and rebuild web:
```
docker exec -i agenomy-postgres psql -U aeon -d agenomy < /opt/agenomy/migrations/005_memory.sql
pnpm --filter @agenomy/web build && pm2 restart agenomy-web && pm2 save
```

- [ ] **Step 4: Verify live**

```
curl -s https://agenomylayer.com/api/agents/wizard/memory   # → { entries: [...], snapshot: null|{...} }
```
Run a skill on `wizard`, then GET `/memory` again → an `auto` entry appears. Open `/agents/wizard` → Memory panel shows entries; rail "Memory" has no "soon" tag.

---

## Notes

- Auto-memory uses the run's own output (no extra LLM call) — keeps the MiMo key safe per the cost-sensitivity constraint.
- IPFS anchoring happens only on owner pin/delete/anchor (not on every run) to keep the run path fast.
- On-chain attestation is intentionally deferred to Slice 6 (mainnet) and labeled in the UI.
- After deploy, consider spawning a clean demo agent with real skills (separate task) so the showcase is consistent.
