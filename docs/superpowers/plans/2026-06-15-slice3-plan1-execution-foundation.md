# Slice 3 · Plan 1 — Execution Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secret-free foundation of agent execution: a `runs` data model, a tool framework, two real tools (`onchain_read`, `market_data`), and a skill-file format + loader — all unit-tested, so the LLM runtime (Plan 2) can plug straight in.

**Architecture:** A new `@agenomy/runtime` workspace package holds the tool framework, the tools, and the skill loader (pure, dependency-injected, no network in unit tests). A new `runs` table + a small repository in the web app stores execution records. Tools are typed functions with a JSON-schema signature and a real implementation; the loader parses our own markdown `skill.md` files and validates that every declared tool exists. None of this needs a secret — `onchain_read` uses the public Base Sepolia RPC and `market_data` uses DeFiLlama (free, no key).

**Tech Stack:** TypeScript, pnpm workspaces, vitest, viem (Base RPC), `gray-matter` (frontmatter parsing), `pg` (runs table, reusing the web app's pool). This plan is part of the Slice-3 sequence (see the spec at `docs/superpowers/specs/2026-06-15-slice3-execution-design.md`); Plans 2–4 follow.

---

## File Structure

- `packages/runtime/` — NEW workspace package `@agenomy/runtime`
  - `package.json`, `tsconfig.json`, `vitest.config.ts`
  - `src/tools/types.ts` — `Tool`, `ToolResult`, `ToolContext` interfaces
  - `src/tools/registry.ts` — build + look up a tool registry
  - `src/tools/onchain.ts` — `onchain_read` tool (balance, erc20, gasPrice, readContract) over a Base RPC client
  - `src/tools/market.ts` — `market_data` tool (token price, protocol TVL) over DeFiLlama
  - `src/skills/types.ts` — `SkillDef` type
  - `src/skills/loader.ts` — parse + validate one `skill.md` into a `SkillDef`
  - `src/index.ts` — package exports
  - `test/*.test.ts` — unit tests per module
- `skills/` — NEW top-level dir for our skill files
  - `skills/token-info/skill.md` — first real example skill (used by the loader test + Plan 2)
- `migrations/002_runs.sql` — NEW `runs` table
- `apps/web/lib/runs.ts` — NEW runs repository (insert/get/list) reusing `getPool()` from `lib/db.ts`
- `apps/web/test/runs.test.ts` — NEW unit test for the repository (mocked pool, same pattern as existing route tests)

---

## Task 1: Scaffold the `@agenomy/runtime` package

**Files:**
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/tsconfig.json`
- Create: `packages/runtime/vitest.config.ts`
- Create: `packages/runtime/src/index.ts`

- [ ] **Step 1: Create `packages/runtime/package.json`**

```json
{
  "name": "@agenomy/runtime",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "viem": "^2.17.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/runtime/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `packages/runtime/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create a placeholder `packages/runtime/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install + verify the workspace resolves**

Run: `pnpm install`
Expected: completes; `@agenomy/runtime` appears in the workspace. Then `pnpm --filter @agenomy/runtime test` exits 0 (no tests yet → vitest reports "No test files found" but exit 0 with `--passWithNoTests`; if it fails, add `--passWithNoTests` to the test script).

- [ ] **Step 6: Commit**

```bash
git add packages/runtime pnpm-lock.yaml
git commit -m "chore(runtime): scaffold @agenomy/runtime package"
```

---

## Task 2: Tool framework (types + registry)

**Files:**
- Create: `packages/runtime/src/tools/types.ts`
- Create: `packages/runtime/src/tools/registry.ts`
- Test: `packages/runtime/test/registry.test.ts`

- [ ] **Step 1: Write `src/tools/types.ts`** (the interfaces every tool implements)

```ts
import type { JSONSchema7 } from "json-schema";

export interface ToolContext {
  rpcUrl: string;        // Base RPC endpoint
  fetch: typeof fetch;   // injected for testability
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;        // structured result the model reads
  error?: string;        // human-readable failure (model can react)
}

export interface Tool {
  name: string;                 // e.g. "onchain_read"
  description: string;          // shown to the model
  parameters: JSONSchema7;      // JSON-schema for the call args
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

Note: add `"json-schema"` types — `pnpm --filter @agenomy/runtime add -D @types/json-schema`. (Run it now.)

- [ ] **Step 2: Write the failing test `test/registry.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { makeRegistry } from "../src/tools/registry";
import type { Tool } from "../src/tools/types";

const fake: Tool = {
  name: "fake",
  description: "x",
  parameters: { type: "object", properties: {} },
  run: async () => ({ ok: true, data: 1 }),
};

describe("registry", () => {
  it("looks up tools by name and reports missing ones", () => {
    const reg = makeRegistry([fake]);
    expect(reg.get("fake")).toBe(fake);
    expect(reg.has("nope")).toBe(false);
    expect(reg.names()).toEqual(["fake"]);
  });
  it("rejects duplicate names", () => {
    expect(() => makeRegistry([fake, fake])).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm --filter @agenomy/runtime test`
Expected: FAIL ("Cannot find module '../src/tools/registry'").

- [ ] **Step 4: Implement `src/tools/registry.ts`**

```ts
import type { Tool } from "./types";

export interface ToolRegistry {
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  names(): string[];
  all(): Tool[];
}

export function makeRegistry(tools: Tool[]): ToolRegistry {
  const map = new Map<string, Tool>();
  for (const t of tools) {
    if (map.has(t.name)) throw new Error(`duplicate tool: ${t.name}`);
    map.set(t.name, t);
  }
  return {
    get: (n) => map.get(n),
    has: (n) => map.has(n),
    names: () => [...map.keys()],
    all: () => [...map.values()],
  };
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @agenomy/runtime test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/runtime
git commit -m "feat(runtime): tool framework (types + registry)"
```

---

## Task 3: `onchain_read` tool

**Files:**
- Create: `packages/runtime/src/tools/onchain.ts`
- Test: `packages/runtime/test/onchain.test.ts`

- [ ] **Step 1: Write the failing test `test/onchain.test.ts`** (inject a fake viem client)

```ts
import { describe, it, expect } from "vitest";
import { onchainRead } from "../src/tools/onchain";

// a minimal fake client matching the subset we use
const fakeClient = {
  getBalance: async ({ address }: { address: string }) => 1000000000000000000n, // 1 ETH
  getGasPrice: async () => 1500000000n,
  readContract: async ({ functionName }: { functionName: string }) =>
    functionName === "symbol" ? "USDC" : 6,
};

describe("onchain_read", () => {
  it("reports an ETH balance as a decimal string", async () => {
    const r = await onchainRead.run(
      { action: "balance", address: "0x0000000000000000000000000000000000000001" },
      { rpcUrl: "x", fetch, makeClient: () => fakeClient } as any,
    );
    expect(r.ok).toBe(true);
    expect((r.data as any).eth).toBe("1");
  });
  it("rejects a malformed address", async () => {
    const r = await onchainRead.run({ action: "balance", address: "nope" }, { makeClient: () => fakeClient } as any);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/address/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @agenomy/runtime test test/onchain.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/tools/onchain.ts`**

```ts
import { createPublicClient, http, formatEther, isAddress, getContract } from "viem";
import { baseSepolia } from "viem/chains";
import type { Tool, ToolContext, ToolResult } from "./types";

const ERC20 = [
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// ctx.makeClient lets tests inject a fake; default builds a real viem client.
type Ctx = ToolContext & { makeClient?: () => any };
function client(ctx: Ctx) {
  return ctx.makeClient ? ctx.makeClient() : createPublicClient({ chain: baseSepolia, transport: http(ctx.rpcUrl) });
}

export const onchainRead: Tool = {
  name: "onchain_read",
  description: "Read Base (Sepolia) on-chain data: native ETH balance, ERC-20 token metadata/balance, current gas price.",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["balance", "erc20", "gasPrice"] },
      address: { type: "string", description: "0x address for balance/erc20" },
      token: { type: "string", description: "ERC-20 contract for action=erc20" },
    },
  },
  async run(args, ctx: Ctx): Promise<ToolResult> {
    try {
      const c = client(ctx);
      const action = String(args.action);
      if (action === "gasPrice") {
        const wei = await c.getGasPrice();
        return { ok: true, data: { gwei: Number(wei) / 1e9 } };
      }
      const address = String(args.address ?? "");
      if (!isAddress(address)) return { ok: false, error: `invalid address: ${address}` };
      if (action === "balance") {
        const wei = await c.getBalance({ address });
        return { ok: true, data: { eth: formatEther(wei) } };
      }
      if (action === "erc20") {
        const token = String(args.token ?? "");
        if (!isAddress(token)) return { ok: false, error: `invalid token address: ${token}` };
        const [symbol, decimals, raw] = await Promise.all([
          c.readContract({ address: token, abi: ERC20, functionName: "symbol" }),
          c.readContract({ address: token, abi: ERC20, functionName: "decimals" }),
          c.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [address] }),
        ]);
        const bal = Number(raw) / 10 ** Number(decimals);
        return { ok: true, data: { token, symbol, balance: bal } };
      }
      return { ok: false, error: `unknown action: ${action}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "onchain_read failed" };
    }
  },
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @agenomy/runtime test test/onchain.test.ts`
Expected: PASS (2 tests). (The fake client's `readContract` is only exercised by Plan-2 integration; the two unit cases here hit `balance` + validation.)

- [ ] **Step 5: Commit**

```bash
git add packages/runtime
git commit -m "feat(runtime): onchain_read tool (Base RPC)"
```

---

## Task 4: `market_data` tool (DeFiLlama)

**Files:**
- Create: `packages/runtime/src/tools/market.ts`
- Test: `packages/runtime/test/market.test.ts`

- [ ] **Step 1: Write the failing test `test/market.test.ts`** (inject a fake fetch)

```ts
import { describe, it, expect } from "vitest";
import { marketData } from "../src/tools/market";

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as any;
}

describe("market_data", () => {
  it("returns a coin price from DeFiLlama", async () => {
    const f = fakeFetch({ coins: { "coingecko:ethereum": { price: 3500, symbol: "ETH" } } });
    const r = await marketData.run({ action: "price", id: "coingecko:ethereum" }, { rpcUrl: "x", fetch: f });
    expect(r.ok).toBe(true);
    expect((r.data as any).price).toBe(3500);
  });
  it("surfaces an upstream error", async () => {
    const r = await marketData.run({ action: "price", id: "x" }, { rpcUrl: "x", fetch: fakeFetch({}, false) });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @agenomy/runtime test test/market.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/tools/market.ts`**

```ts
import type { Tool, ToolContext, ToolResult } from "./types";

export const marketData: Tool = {
  name: "market_data",
  description: "Token prices and DeFi protocol TVL via DeFiLlama (free). action=price needs a DeFiLlama coin id like 'coingecko:ethereum'; action=tvl needs a protocol slug like 'aave'.",
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["price", "tvl"] },
      id: { type: "string", description: "coin id (price) e.g. coingecko:ethereum" },
      protocol: { type: "string", description: "protocol slug (tvl) e.g. aave" },
    },
  },
  async run(args, ctx: ToolContext): Promise<ToolResult> {
    try {
      const action = String(args.action);
      if (action === "price") {
        const id = String(args.id ?? "");
        const res = await ctx.fetch(`https://coins.llama.fi/prices/current/${encodeURIComponent(id)}`);
        if (!res.ok) return { ok: false, error: `DeFiLlama prices ${res.status}` };
        const body = (await res.json()) as { coins: Record<string, { price: number; symbol?: string }> };
        const coin = body.coins?.[id];
        if (!coin) return { ok: false, error: `no price for ${id}` };
        return { ok: true, data: { id, price: coin.price, symbol: coin.symbol } };
      }
      if (action === "tvl") {
        const slug = String(args.protocol ?? "");
        const res = await ctx.fetch(`https://api.llama.fi/tvl/${encodeURIComponent(slug)}`);
        if (!res.ok) return { ok: false, error: `DeFiLlama tvl ${res.status}` };
        const tvl = (await res.json()) as number;
        return { ok: true, data: { protocol: slug, tvlUsd: tvl } };
      }
      return { ok: false, error: `unknown action: ${action}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "market_data failed" };
    }
  },
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @agenomy/runtime test test/market.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/runtime
git commit -m "feat(runtime): market_data tool (DeFiLlama)"
```

---

## Task 5: Skill format + loader

**Files:**
- Create: `packages/runtime/src/skills/types.ts`
- Create: `packages/runtime/src/skills/loader.ts`
- Create: `skills/token-info/skill.md` (first real skill file)
- Test: `packages/runtime/test/loader.test.ts`

- [ ] **Step 1: Write `src/skills/types.ts`**

```ts
export interface SkillDef {
  slug: string;
  name: string;
  category: string;
  tools: string[];        // declared tool names this skill may call
  schedule: string | null; // cron string (Plan 4) or null = on-demand
  inputs: string;         // human description of expected input
  prompt: string;         // the markdown body = the agent instructions
}
```

- [ ] **Step 2: Create the example skill `skills/token-info/skill.md`**

```markdown
---
slug: token-info
name: Token Info
category: onchain
tools: [onchain_read]
schedule: null
inputs: An ERC-20 token contract address on Base.
---
You are {{persona}}. Look up the given ERC-20 token on Base using onchain_read
(action=erc20 / action=balance as needed). Report its symbol, decimals, and any
balance asked for. Only state values returned by the tool. If a read fails, say so
plainly. Be concise.
```

- [ ] **Step 3: Write the failing test `test/loader.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseSkill } from "../src/skills/loader";

const md = `---\nslug: token-info\nname: Token Info\ncategory: onchain\ntools: [onchain_read]\nschedule: null\ninputs: A token address.\n---\nDo the thing with onchain_read.`;

describe("parseSkill", () => {
  it("parses frontmatter + body into a SkillDef", () => {
    const s = parseSkill(md, ["onchain_read", "market_data"]);
    expect(s.slug).toBe("token-info");
    expect(s.tools).toEqual(["onchain_read"]);
    expect(s.schedule).toBeNull();
    expect(s.prompt.trim()).toBe("Do the thing with onchain_read.");
  });
  it("throws if a declared tool does not exist", () => {
    const bad = md.replace("[onchain_read]", "[ghost_tool]");
    expect(() => parseSkill(bad, ["onchain_read"])).toThrow(/ghost_tool/);
  });
  it("throws on a missing required field", () => {
    const bad = md.replace("slug: token-info\n", "");
    expect(() => parseSkill(bad, ["onchain_read"])).toThrow(/slug/);
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `pnpm --filter @agenomy/runtime test test/loader.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement `src/skills/loader.ts`**

```ts
import matter from "gray-matter";
import type { SkillDef } from "./types";

/** Parse one skill.md string into a validated SkillDef. `knownTools` = registry names. */
export function parseSkill(md: string, knownTools: string[]): SkillDef {
  const { data, content } = matter(md);
  const need = ["slug", "name", "category", "inputs"] as const;
  for (const k of need) {
    if (typeof data[k] !== "string" || data[k].length === 0) {
      throw new Error(`skill frontmatter missing required field: ${k}`);
    }
  }
  const tools = Array.isArray(data.tools) ? data.tools.map(String) : [];
  for (const t of tools) {
    if (!knownTools.includes(t)) throw new Error(`skill "${data.slug}" declares unknown tool: ${t}`);
  }
  const schedule =
    data.schedule === null || data.schedule === undefined || data.schedule === "null"
      ? null
      : String(data.schedule);
  const prompt = content.trim();
  if (!prompt) throw new Error(`skill "${data.slug}" has an empty prompt body`);
  return {
    slug: String(data.slug),
    name: String(data.name),
    category: String(data.category),
    tools,
    schedule,
    inputs: String(data.inputs),
    prompt,
  };
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `pnpm --filter @agenomy/runtime test test/loader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Export everything from `src/index.ts`**

```ts
export * from "./tools/types";
export * from "./tools/registry";
export { onchainRead } from "./tools/onchain";
export { marketData } from "./tools/market";
export * from "./skills/types";
export { parseSkill } from "./skills/loader";
```

- [ ] **Step 8: Run the full package test suite + typecheck**

Run: `pnpm --filter @agenomy/runtime test && pnpm --filter @agenomy/runtime typecheck`
Expected: all tests PASS; tsc clean.

- [ ] **Step 9: Commit**

```bash
git add packages/runtime skills
git commit -m "feat(runtime): skill format + loader, first skill file"
```

---

## Task 6: `runs` data model (migration + repository)

**Files:**
- Create: `migrations/002_runs.sql`
- Create: `apps/web/lib/runs.ts`
- Test: `apps/web/test/runs.test.ts`

- [ ] **Step 1: Write `migrations/002_runs.sql`**

```sql
CREATE TABLE IF NOT EXISTS runs (
  id           BIGSERIAL PRIMARY KEY,
  agent_handle TEXT NOT NULL,
  skill_slug   TEXT NOT NULL,
  input        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'running',  -- running | ok | error
  output       TEXT,
  trace        JSONB NOT NULL DEFAULT '[]',
  model        TEXT,
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS runs_agent_idx ON runs (agent_handle, started_at DESC);
```

- [ ] **Step 2: Write the failing test `apps/web/test/runs.test.ts`** (mock the pool, mirroring existing route tests)

```ts
import { describe, it, expect, vi } from "vitest";

const query = vi.fn();
vi.mock("../lib/db", () => ({ getPool: () => ({ query }) }));

import { createRun, finishRun, listRuns } from "../lib/runs";

describe("runs repository", () => {
  it("inserts a running run and returns its id", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "7" }], rowCount: 1 });
    const id = await createRun({ agentHandle: "wizard", skillSlug: "token-info", input: "0xabc" });
    expect(id).toBe("7");
    expect(query.mock.calls[0][0]).toMatch(/INSERT INTO runs/i);
  });
  it("finishes a run with output + status", async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    await finishRun("7", { status: "ok", output: "done", trace: [], model: "claude", tokensIn: 10, tokensOut: 20 });
    expect(query.mock.calls[0][0]).toMatch(/UPDATE runs/i);
  });
  it("lists runs for an agent newest-first", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "7", agent_handle: "wizard" }], rowCount: 1 });
    const rows = await listRuns("wizard");
    expect(rows[0].id).toBe("7");
    expect(query.mock.calls[0][0]).toMatch(/WHERE agent_handle = \$1/i);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm --filter @agenomy/web test test/runs.test.ts`
Expected: FAIL ("Cannot find module '../lib/runs'").

- [ ] **Step 4: Implement `apps/web/lib/runs.ts`**

```ts
import { getPool } from "./db";

export interface NewRun {
  agentHandle: string;
  skillSlug: string;
  input: string;
}
export interface RunFinish {
  status: "ok" | "error";
  output?: string;
  trace?: unknown[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

export async function createRun(r: NewRun): Promise<string> {
  const res = await getPool().query(
    `INSERT INTO runs (agent_handle, skill_slug, input) VALUES ($1,$2,$3) RETURNING id`,
    [r.agentHandle, r.skillSlug, r.input],
  );
  return String(res.rows[0].id);
}

export async function finishRun(id: string, f: RunFinish): Promise<void> {
  await getPool().query(
    `UPDATE runs SET status=$2, output=$3, trace=$4, model=$5, tokens_in=$6, tokens_out=$7, error=$8, finished_at=now() WHERE id=$1`,
    [id, f.status, f.output ?? null, JSON.stringify(f.trace ?? []), f.model ?? null, f.tokensIn ?? null, f.tokensOut ?? null, f.error ?? null],
  );
}

export async function listRuns(agentHandle: string, limit = 20): Promise<Array<Record<string, unknown>>> {
  const res = await getPool().query(
    `SELECT id, agent_handle, skill_slug, input, status, output, model, started_at, finished_at
     FROM runs WHERE agent_handle = $1 ORDER BY started_at DESC LIMIT $2`,
    [agentHandle, limit],
  );
  return res.rows;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @agenomy/web test test/runs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Apply the migration to the VPS Postgres** (deploy step — the runner/web need the table)

Pipe the migration into the VPS DB (same method used for `001_init.sql`):
Run: `"/c/Program Files/PuTTY/plink" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -ssh -pw <VPS_PW> root@13.140.173.196 "docker exec -i agenomy-postgres psql -U aeon -d agenomy -v ON_ERROR_STOP=1" < "migrations/002_runs.sql"` (sandbox disabled)
Expected: `CREATE TABLE` + `CREATE INDEX`. Verify with `\dt` shows a `runs` table.

- [ ] **Step 7: Commit**

```bash
git add migrations/002_runs.sql apps/web/lib/runs.ts apps/web/test/runs.test.ts
git commit -m "feat(web): runs table + repository"
```

---

## Task 7: Wire `@agenomy/runtime` into the web app dependency graph

**Files:**
- Modify: `apps/web/package.json` (add the workspace dep so Plan 2 can import it)

- [ ] **Step 1: Add the dependency**

In `apps/web/package.json`, under `"dependencies"`, add: `"@agenomy/runtime": "workspace:*",`

- [ ] **Step 2: Install + verify the web app still builds**

Run: `pnpm install && pnpm --filter @agenomy/web exec tsc --noEmit && pnpm --filter @agenomy/web test`
Expected: install OK; tsc clean; all existing web tests (60) still green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): depend on @agenomy/runtime"
```

---

## Self-Review

- **Spec coverage (Plan-1 portion):** skill format + loader ✅ (Task 5); real tools `onchain_read` + `market_data` ✅ (Tasks 3–4); tool framework ✅ (Task 2); `runs` data model ✅ (Task 6). Deferred to later plans (correctly out of Plan 1): LLM runtime/agent loop, `/run` API + Invoke/Runs UI (Plan 2, needs credential), `explorer` + `web_search` tools + ~30 skills (Plan 3), scheduling + MiMo (Plan 4). No Plan-1 spec item is unimplemented.
- **Placeholder scan:** every code step contains complete code; commands have expected output. No TBD/TODO.
- **Type consistency:** `Tool`/`ToolContext`/`ToolResult` defined in Task 2 are used consistently in Tasks 3–4; `SkillDef` (Task 5) matches the loader output; `runs` columns in the migration (Task 6) match the repository's INSERT/UPDATE/SELECT. The `ctx.makeClient` test seam used in Task 3 is documented in the implementation.

## Execution Handoff
Plans 2–4 depend on this. Plan 2 (the LLM runtime) additionally needs the user's LLM credential on the VPS and should consult the `claude-api` skill for exact model IDs + SDK usage before implementation.
