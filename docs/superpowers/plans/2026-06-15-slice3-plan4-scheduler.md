# Slice 3 / Plan 4 — Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent run a skill on a recurring schedule, unattended, through the exact same execution path as an on-demand run.

**Architecture:** A new `@agenomy/invoker` package holds the single `invokeSkillRun()` used by both the web run route and a new `apps/scheduler` pm2 worker. The worker polls a `schedules` table every 60s and fires due runs. The web app gains schedule CRUD routes + a Schedules UI card.

**Tech Stack:** TypeScript (ESM, consumed as source via `transpilePackages`/`tsx`), PostgreSQL (`pg`), `cron-parser`, vitest, Next.js 15.

**Spec:** `docs/superpowers/specs/2026-06-15-slice3-plan4-scheduler-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `migrations/003_schedules.sql` | `schedules` table + `runs.source` column |
| `packages/invoker/src/db.ts` | structural `Queryable` pool interface (decouples from apps) |
| `packages/invoker/src/runs.ts` | `createRun`/`finishRun`/`listRuns` (moved from web, + `source`) |
| `packages/invoker/src/cron.ts` | presets, `nextRun`, `validateCron`, `cadenceLabel` |
| `packages/invoker/src/schedules.ts` | schedule + due-query DB helpers |
| `packages/invoker/src/invoke.ts` | `invokeSkillRun()` — the single execution path |
| `packages/invoker/src/index.ts` | barrel exports |
| `packages/invoker/test/*` | unit tests + `fakePool` helper |
| `apps/web/app/api/agents/[handle]/run/route.ts` | refactor to call `invokeSkillRun` |
| `apps/web/lib/runs.ts` | thin `listRuns` wrapper over invoker |
| `apps/web/app/api/agents/[handle]/schedules/route.ts` | GET list / POST create |
| `apps/web/app/api/agents/[handle]/schedules/[id]/route.ts` | PATCH toggle / DELETE |
| `apps/scheduler/src/scheduler.ts` | `runOnce`/`runLoop` (deps-injected, testable) |
| `apps/scheduler/src/main.ts` | wires real pg + invoker into the loop |
| `apps/web/app/agents/[handle]/SchedulesPanel.tsx` | schedule UI card |
| `apps/web/app/agents/[handle]/InvokePanel.tsx` | add "scheduled" badge to runs list |

---

## Task 1: Migration 003 — schedules table + runs.source

**Files:**
- Create: `migrations/003_schedules.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/003_schedules.sql
ALTER TABLE runs ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';  -- manual | scheduled

CREATE TABLE IF NOT EXISTS schedules (
  id            BIGSERIAL PRIMARY KEY,
  agent_handle  TEXT NOT NULL,
  skill_slug    TEXT NOT NULL,
  input         TEXT NOT NULL DEFAULT '',
  cron          TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedules_due_idx ON schedules (enabled, next_run_at);
```

- [ ] **Step 2: Apply to the local DB and verify**

Run (local Postgres from docker-compose must be up):
```bash
docker compose exec -T db psql -U postgres -d agenomy -f - < migrations/003_schedules.sql
docker compose exec -T db psql -U postgres -d agenomy -c "\d schedules"
```
Expected: the `\d schedules` output lists all 9 columns and the `schedules_due_idx` index. (If the DB user/name differ, match `DATABASE_URL` in `.env.local`.)

- [ ] **Step 3: Commit**

```bash
git add migrations/003_schedules.sql
git commit -m "feat(db): migration 003 - schedules table + runs.source"
```

---

## Task 2: Scaffold @agenomy/invoker package

**Files:**
- Create: `packages/invoker/package.json`
- Create: `packages/invoker/tsconfig.json`
- Create: `packages/invoker/src/db.ts`
- Create: `packages/invoker/src/index.ts`
- Create: `packages/invoker/test/fakePool.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@agenomy/invoker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@agenomy/runtime": "workspace:*",
    "cron-parser": "^4.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json** (matches `packages/runtime/tsconfig.json`)

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

- [ ] **Step 3: src/db.ts** — structural pool interface (both `pg.Pool` and the web's `QueryablePool` satisfy this)

```ts
export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

/** Anything with a node-postgres style query(). Lets the package stay app-agnostic. */
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}
```

- [ ] **Step 4: src/index.ts** (barrel — modules added by later tasks)

```ts
export * from "./db";
export * from "./runs";
export * from "./cron";
export * from "./schedules";
export * from "./invoke";
```

- [ ] **Step 5: test/fakePool.ts** — shared test helper

```ts
import type { Queryable, QueryResultLike } from "../src/db";

export interface FakeCall {
  text: string;
  values?: unknown[];
}
export type Responder = (text: string, values?: unknown[]) => QueryResultLike | undefined;

/** A pool whose query() routes to `respond` and records every call. */
export function fakePool(respond: Responder): Queryable & { calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  return {
    calls,
    async query(text: string, values?: unknown[]): Promise<QueryResultLike> {
      calls.push({ text, values });
      return respond(text, values) ?? { rowCount: 0, rows: [] };
    },
  };
}
```

> NOTE: `index.ts` imports `./runs`, `./cron`, `./schedules`, `./invoke` which don't exist yet — it will not typecheck until Task 6. That's expected; do not run a build between here and Task 6. The per-module tests in Tasks 3-6 run independently.

- [ ] **Step 6: Install so the workspace links the package**

Run:
```bash
pnpm install
```
Expected: completes; `@agenomy/invoker` appears in the workspace. (Ignore unresolved-import type errors in `index.ts` until Task 6.)

- [ ] **Step 7: Commit**

```bash
git add packages/invoker/package.json packages/invoker/tsconfig.json packages/invoker/src/db.ts packages/invoker/src/index.ts packages/invoker/test/fakePool.ts pnpm-lock.yaml
git commit -m "chore(invoker): scaffold @agenomy/invoker package"
```

---

## Task 3: runs DB helpers (moved into invoker, with `source`)

**Files:**
- Create: `packages/invoker/src/runs.ts`
- Test: `packages/invoker/test/runs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/runs.test.ts`
Expected: FAIL — cannot find module `../src/runs`.

- [ ] **Step 3: Implement src/runs.ts**

```ts
// packages/invoker/src/runs.ts
import type { Queryable } from "./db";

export type RunSource = "manual" | "scheduled";

export interface NewRun {
  agentHandle: string;
  skillSlug: string;
  input: string;
  source: RunSource;
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

export async function createRun(pool: Queryable, r: NewRun): Promise<string> {
  const res = await pool.query(
    `INSERT INTO runs (agent_handle, skill_slug, input, source) VALUES ($1,$2,$3,$4) RETURNING id`,
    [r.agentHandle, r.skillSlug, r.input, r.source],
  );
  return String(res.rows[0].id);
}

export async function finishRun(pool: Queryable, id: string, f: RunFinish): Promise<void> {
  await pool.query(
    `UPDATE runs SET status=$2, output=$3, trace=$4, model=$5, tokens_in=$6, tokens_out=$7, error=$8, finished_at=now() WHERE id=$1`,
    [
      id,
      f.status,
      f.output ?? null,
      JSON.stringify(f.trace ?? []),
      f.model ?? null,
      f.tokensIn ?? null,
      f.tokensOut ?? null,
      f.error ?? null,
    ],
  );
}

export async function listRuns(
  pool: Queryable,
  agentHandle: string,
  limit = 20,
): Promise<Array<Record<string, unknown>>> {
  const res = await pool.query(
    `SELECT id, agent_handle, skill_slug, input, status, output, model, source, started_at, finished_at
     FROM runs WHERE agent_handle = $1 ORDER BY started_at DESC LIMIT $2`,
    [agentHandle, limit],
  );
  return res.rows;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/runs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/invoker/src/runs.ts packages/invoker/test/runs.test.ts
git commit -m "feat(invoker): runs DB helpers with source column"
```

---

## Task 4: cron helpers

**Files:**
- Create: `packages/invoker/src/cron.ts`
- Test: `packages/invoker/test/cron.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/cron.test.ts`
Expected: FAIL — cannot find module `../src/cron`.

- [ ] **Step 3: Implement src/cron.ts**

```ts
// packages/invoker/src/cron.ts
import parser from "cron-parser";

export const PRESETS: Record<string, string> = {
  hourly: "0 * * * *",
  every_6h: "0 */6 * * *",
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
};

const PRESET_LABELS: Record<string, string> = {
  "0 * * * *": "Hourly",
  "0 */6 * * *": "Every 6 hours",
  "0 9 * * *": "Daily 09:00 UTC",
  "0 9 * * 1": "Weekly (Mon 09:00 UTC)",
};

const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function presetToCron(preset: string): string | null {
  return PRESETS[preset] ?? null;
}

/** Next fire time strictly after `from`, evaluated in UTC. */
export function nextRun(cron: string, from: Date): Date {
  const it = parser.parseExpression(cron, { currentDate: from, tz: "UTC" });
  return it.next().toDate();
}

/** Valid cron AND fires no more often than once per hour. */
export function validateCron(cron: string): { ok: boolean; error?: string } {
  let it;
  try {
    it = parser.parseExpression(cron, { tz: "UTC" });
  } catch {
    return { ok: false, error: "invalid cron expression" };
  }
  const a = it.next().toDate().getTime();
  const b = it.next().toDate().getTime();
  if (b - a < MIN_INTERVAL_MS) {
    return { ok: false, error: "schedule must run at most once per hour" };
  }
  return { ok: true };
}

export function cadenceLabel(cron: string): string {
  return PRESET_LABELS[cron] ?? cron;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/cron.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/invoker/src/cron.ts packages/invoker/test/cron.test.ts
git commit -m "feat(invoker): cron presets, nextRun, validateCron, cadenceLabel"
```

---

## Task 5: schedules DB helpers

**Files:**
- Create: `packages/invoker/src/schedules.ts`
- Test: `packages/invoker/test/schedules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/schedules.test.ts`
Expected: FAIL — cannot find module `../src/schedules`.

- [ ] **Step 3: Implement src/schedules.ts**

```ts
// packages/invoker/src/schedules.ts
import type { Queryable } from "./db";
import { nextRun } from "./cron";

export interface ScheduleRow {
  id: string;
  agent_handle: string;
  skill_slug: string;
  input: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

export interface NewSchedule {
  agentHandle: string;
  skillSlug: string;
  input: string;
  cron: string;
}

const COLS = `id, agent_handle, skill_slug, input, cron, enabled, last_run_at, next_run_at, created_at`;

export async function createSchedule(pool: Queryable, s: NewSchedule, from: Date): Promise<string> {
  const next = nextRun(s.cron, from);
  const res = await pool.query(
    `INSERT INTO schedules (agent_handle, skill_slug, input, cron, next_run_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [s.agentHandle, s.skillSlug, s.input, s.cron, next.toISOString()],
  );
  return String(res.rows[0].id);
}

export async function listSchedules(pool: Queryable, handle: string): Promise<ScheduleRow[]> {
  const res = await pool.query(
    `SELECT ${COLS} FROM schedules WHERE agent_handle = $1 ORDER BY created_at DESC`,
    [handle],
  );
  return res.rows as unknown as ScheduleRow[];
}

export async function countSchedules(pool: Queryable, handle: string): Promise<number> {
  const res = await pool.query(`SELECT count(*)::int AS n FROM schedules WHERE agent_handle = $1`, [handle]);
  return Number(res.rows[0].n);
}

export async function setScheduleEnabled(
  pool: Queryable,
  handle: string,
  id: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(`UPDATE schedules SET enabled = $3 WHERE id = $1 AND agent_handle = $2`, [
    id,
    handle,
    enabled,
  ]);
}

export async function deleteSchedule(pool: Queryable, handle: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM schedules WHERE id = $1 AND agent_handle = $2`, [id, handle]);
}

export async function dueSchedules(pool: Queryable, now: Date): Promise<ScheduleRow[]> {
  const res = await pool.query(
    `SELECT ${COLS} FROM schedules WHERE enabled AND next_run_at <= $1 ORDER BY next_run_at ASC LIMIT 50`,
    [now.toISOString()],
  );
  return res.rows as unknown as ScheduleRow[];
}

export async function claimNextRun(pool: Queryable, id: string, next: Date): Promise<void> {
  await pool.query(`UPDATE schedules SET next_run_at = $2 WHERE id = $1`, [id, next.toISOString()]);
}

export async function markRan(pool: Queryable, id: string, ranAt: Date): Promise<void> {
  await pool.query(`UPDATE schedules SET last_run_at = $2 WHERE id = $1`, [id, ranAt.toISOString()]);
}

export async function countScheduledRunsSince(pool: Queryable, since: Date): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM runs WHERE source = 'scheduled' AND started_at >= $1`,
    [since.toISOString()],
  );
  return Number(res.rows[0].n);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/schedules.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/invoker/src/schedules.ts packages/invoker/test/schedules.test.ts
git commit -m "feat(invoker): schedules DB helpers + due query + daily-cap count"
```

---

## Task 6: invokeSkillRun — the single execution path

**Files:**
- Create: `packages/invoker/src/invoke.ts`
- Test: `packages/invoker/test/invoke.test.ts`

- [ ] **Step 1: Write the failing test** (uses the real `skills/` dir + a mocked LLM)

```ts
// packages/invoker/test/invoke.test.ts
import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { invokeSkillRun } from "../src/invoke";
import { fakePool } from "./fakePool";

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../skills");

// OpenAI-compatible response with a final message and no tool calls
function mockLLM(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Base gas is about 0.01 gwei." } }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
}

const env = {
  llmBaseUrl: "http://llm.test/v1",
  llmApiKey: "k",
  llmModel: "m",
  rpcUrl: "http://rpc.test",
  skillsDir,
};

describe("invokeSkillRun", () => {
  it("loads persona + skill, records a run, returns the output", async () => {
    let finished = false;
    const pool = fakePool((text) => {
      if (text.includes("SELECT persona")) {
        return { rowCount: 1, rows: [{ persona: { displayName: "Gas Watcher", bio: "watches gas" } }] };
      }
      if (text.includes("INSERT INTO runs")) return { rowCount: 1, rows: [{ id: 7 }] };
      if (text.includes("UPDATE runs")) {
        finished = true;
        return { rowCount: 1, rows: [] };
      }
      return undefined;
    });

    const r = await invokeSkillRun({
      pool,
      handle: "gas",
      skillSlug: "base-gas-check",
      input: "",
      source: "scheduled",
      env,
      fetchFn: mockLLM(),
    });

    expect(r.status).toBe("ok");
    expect(r.runId).toBe("7");
    expect(r.output).toContain("gwei");
    expect(finished).toBe(true);
    // createRun got source='scheduled'
    const insert = pool.calls.find((c) => c.text.includes("INSERT INTO runs"))!;
    expect(insert.values![3]).toBe("scheduled");
  });

  it("returns agent_not_found when the agent is missing", async () => {
    const pool = fakePool((text) =>
      text.includes("SELECT persona") ? { rowCount: 0, rows: [] } : undefined,
    );
    const r = await invokeSkillRun({
      pool,
      handle: "ghost",
      skillSlug: "base-gas-check",
      input: "",
      source: "manual",
      env,
      fetchFn: mockLLM(),
    });
    expect(r.invokeError).toBe("agent_not_found");
  });

  it("returns unknown_skill for a slug not in the catalog", async () => {
    const pool = fakePool((text) =>
      text.includes("SELECT persona")
        ? { rowCount: 1, rows: [{ persona: { displayName: "X" } }] }
        : undefined,
    );
    const r = await invokeSkillRun({
      pool,
      handle: "gas",
      skillSlug: "does-not-exist",
      input: "",
      source: "manual",
      env,
      fetchFn: mockLLM(),
    });
    expect(r.invokeError).toBe("unknown_skill");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/invoke.test.ts`
Expected: FAIL — cannot find module `../src/invoke`.

- [ ] **Step 3: Implement src/invoke.ts**

```ts
// packages/invoker/src/invoke.ts
import {
  runAgent,
  makeRegistry,
  onchainRead,
  marketData,
  loadSkillsFromDir,
  type ProviderConfig,
} from "@agenomy/runtime";
import type { Queryable } from "./db";
import { createRun, finishRun, type RunSource } from "./runs";

export interface InvokeEnv {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  rpcUrl: string;
  skillsDir: string;
}

export type InvokeError = "agent_not_found" | "unknown_skill" | "llm_not_configured";

export interface InvokeOpts {
  pool: Queryable;
  handle: string;
  skillSlug: string;
  input: string;
  source: RunSource;
  env: InvokeEnv;
  fetchFn?: typeof fetch; // test seam for the provider call
}

export interface InvokeResult {
  runId?: string;
  status: "ok" | "error";
  output: string;
  trace: unknown[];
  error?: string;
  invokeError?: InvokeError;
}

const TOOLS = [onchainRead, marketData];

function fail(error: string, invokeError: InvokeError): InvokeResult {
  return { status: "error", output: "", trace: [], error, invokeError };
}

/** The single agent-run code path. Used by the web run route (manual) and the scheduler (scheduled). */
export async function invokeSkillRun(opts: InvokeOpts): Promise<InvokeResult> {
  const { pool, handle, skillSlug, input, source, env } = opts;

  const ares = await pool.query(`SELECT persona FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return fail("agent not found", "agent_not_found");
  const p = (ares.rows[0].persona ?? {}) as { displayName?: string; bio?: string };
  const persona = [p.displayName, p.bio].filter(Boolean).join(". ") || handle;

  const registry = makeRegistry(TOOLS);
  const skill = loadSkillsFromDir(env.skillsDir, registry.names()).find((s) => s.slug === skillSlug);
  if (!skill) return fail(`unknown skill: ${skillSlug}`, "unknown_skill");

  const provider: ProviderConfig = { baseUrl: env.llmBaseUrl, apiKey: env.llmApiKey, model: env.llmModel };
  if (!provider.baseUrl || !provider.apiKey || !provider.model) {
    return fail("LLM not configured", "llm_not_configured");
  }

  const runId = await createRun(pool, { agentHandle: handle, skillSlug, input, source });
  const result = await runAgent({
    skill,
    persona,
    input,
    registry,
    provider,
    toolCtx: { rpcUrl: env.rpcUrl, fetch },
    fetchFn: opts.fetchFn,
  });
  await finishRun(pool, runId, {
    status: result.status,
    output: result.output,
    trace: result.trace,
    model: provider.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    error: result.error,
  });

  return { runId, status: result.status, output: result.output, trace: result.trace, error: result.error };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @agenomy/invoker exec vitest run test/invoke.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck the whole package (index.ts now resolves)**

Run: `pnpm --filter @agenomy/invoker exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full invoker test suite**

Run: `pnpm --filter @agenomy/invoker test`
Expected: PASS (runs + cron + schedules + invoke = 17 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/invoker/src/invoke.ts packages/invoker/test/invoke.test.ts
git commit -m "feat(invoker): invokeSkillRun single execution path"
```

---

## Task 7: Refactor the web run route to use invokeSkillRun

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Modify: `apps/web/next.config.mjs` (transpile the package)
- Modify: `apps/web/app/api/agents/[handle]/run/route.ts`
- Modify: `apps/web/lib/runs.ts` (thin `listRuns` wrapper)

- [ ] **Step 1: Add the dependency + transpile**

In `apps/web/package.json`, add to `dependencies` (alongside `@agenomy/runtime`):
```json
    "@agenomy/invoker": "workspace:*",
```

In `apps/web/next.config.mjs`, extend `transpilePackages`:
```js
  transpilePackages: ["@agenomy/shared", "@agenomy/runtime", "@agenomy/invoker"],
```

Run:
```bash
pnpm install
```
Expected: links `@agenomy/invoker` into `apps/web`.

- [ ] **Step 2: Replace the run route body**

Replace the entire contents of `apps/web/app/api/agents/[handle]/run/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { join } from "node:path";
import { invokeSkillRun, type InvokeEnv } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function runEnv(): InvokeEnv {
  return {
    llmBaseUrl: process.env.LLM_BASE_URL ?? "",
    llmApiKey: process.env.LLM_API_KEY ?? "",
    llmModel: process.env.LLM_MODEL ?? "",
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    skillsDir: process.env.SKILLS_DIR || join(process.cwd(), "../../skills"),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { skillSlug?: string; input?: string };
  const skillSlug = String(body.skillSlug ?? "");
  const input = String(body.input ?? "");
  if (!skillSlug) return NextResponse.json({ error: "skillSlug required" }, { status: 400 });

  const r = await invokeSkillRun({
    pool: getPool(),
    handle,
    skillSlug,
    input,
    source: "manual",
    env: runEnv(),
  });

  if (r.invokeError === "agent_not_found")
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (r.invokeError === "unknown_skill")
    return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });
  if (r.invokeError === "llm_not_configured")
    return NextResponse.json({ error: "LLM not configured" }, { status: 503 });

  return NextResponse.json({
    runId: r.runId,
    status: r.status,
    output: r.output,
    trace: r.trace,
    error: r.error,
  });
}
```

- [ ] **Step 3: Make lib/runs.ts a thin wrapper** (the route no longer uses createRun/finishRun directly; only `/runs` needs listRuns)

Replace the entire contents of `apps/web/lib/runs.ts` with:

```ts
import { getPool } from "./db";
import { listRuns as invokerListRuns } from "@agenomy/invoker";

export function listRuns(agentHandle: string, limit = 20): Promise<Array<Record<string, unknown>>> {
  return invokerListRuns(getPool(), agentHandle, limit);
}
```

(The `/api/agents/[handle]/runs` route imports `listRuns` from here unchanged.)

- [ ] **Step 4: Build the web app to verify the refactor compiles**

Run: `pnpm --filter @agenomy/web build`
Expected: build succeeds. (If a stale `.next` or type cache interferes, `rm -rf apps/web/.next` and rebuild.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/next.config.mjs apps/web/app/api/agents/[handle]/run/route.ts apps/web/lib/runs.ts pnpm-lock.yaml
git commit -m "refactor(web): run route + listRuns use shared @agenomy/invoker"
```

---

## Task 8: Schedules API routes

**Files:**
- Create: `apps/web/app/api/agents/[handle]/schedules/route.ts`
- Create: `apps/web/app/api/agents/[handle]/schedules/[id]/route.ts`

- [ ] **Step 1: GET list / POST create**

```ts
// apps/web/app/api/agents/[handle]/schedules/route.ts
import { NextResponse } from "next/server";
import { join } from "node:path";
import { makeRegistry, onchainRead, marketData, loadSkillsFromDir } from "@agenomy/runtime";
import { createSchedule, listSchedules, countSchedules, validateCron } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const SKILLS_DIR = process.env.SKILLS_DIR || join(process.cwd(), "../../skills");
const MAX_PER_AGENT = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const schedules = await listSchedules(getPool(), handle);
  return NextResponse.json({ schedules });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    skillSlug?: string;
    input?: string;
    cron?: string;
  };
  const skillSlug = String(body.skillSlug ?? "");
  const input = String(body.input ?? "");
  const cron = String(body.cron ?? "").trim();
  if (!skillSlug || !cron)
    return NextResponse.json({ error: "skillSlug and cron required" }, { status: 400 });

  const v = validateCron(cron);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const registry = makeRegistry([onchainRead, marketData]);
  const known = loadSkillsFromDir(SKILLS_DIR, registry.names()).some((s) => s.slug === skillSlug);
  if (!known) return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });

  const pool = getPool();
  const ares = await pool.query(`SELECT 1 FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0)
    return NextResponse.json({ error: "agent not found" }, { status: 404 });

  if ((await countSchedules(pool, handle)) >= MAX_PER_AGENT)
    return NextResponse.json({ error: `max ${MAX_PER_AGENT} schedules per agent` }, { status: 400 });

  const id = await createSchedule(pool, { agentHandle: handle, skillSlug, input, cron }, new Date());
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: PATCH toggle / DELETE**

```ts
// apps/web/app/api/agents/[handle]/schedules/[id]/route.ts
import { NextResponse } from "next/server";
import { setScheduleEnabled, deleteSchedule } from "@agenomy/invoker";
import { getPool } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ handle: string; id: string }> },
): Promise<Response> {
  const { handle, id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  await setScheduleEnabled(getPool(), handle, id, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ handle: string; id: string }> },
): Promise<Response> {
  const { handle, id } = await context.params;
  await deleteSchedule(getPool(), handle, id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Build to verify the routes compile**

Run: `pnpm --filter @agenomy/web build`
Expected: build succeeds and lists the two new `/api/agents/[handle]/schedules` routes.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/agents/[handle]/schedules"
git commit -m "feat(web): schedules API (list/create/toggle/delete) with cron + cap validation"
```

---

## Task 9: Scheduler worker (apps/scheduler)

**Files:**
- Create: `apps/scheduler/package.json`
- Create: `apps/scheduler/tsconfig.json`
- Create: `apps/scheduler/src/scheduler.ts`
- Create: `apps/scheduler/src/main.ts`
- Test: `apps/scheduler/test/scheduler.test.ts`

- [ ] **Step 1: package.json**

```json
{
  "name": "@agenomy/scheduler",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@agenomy/invoker": "workspace:*",
    "@agenomy/runtime": "workspace:*",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/pg": "^8.11.5",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json** (matches `apps/indexer/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: pnpm install** (link the new app)

Run: `pnpm install`
Expected: `@agenomy/scheduler` linked with `@agenomy/invoker`.

- [ ] **Step 4: Write the failing scheduler test**

```ts
// apps/scheduler/test/scheduler.test.ts
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
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm --filter @agenomy/scheduler exec vitest run test/scheduler.test.ts`
Expected: FAIL — cannot find module `../src/scheduler`.

- [ ] **Step 6: Implement src/scheduler.ts**

```ts
// apps/scheduler/src/scheduler.ts
import { nextRun, type ScheduleRow } from "@agenomy/invoker";

export interface SchedulerDeps {
  now: () => Date;
  dueSchedules: (now: Date) => Promise<ScheduleRow[]>;
  claimNextRun: (id: string, next: Date) => Promise<void>;
  markRan: (id: string, ranAt: Date) => Promise<void>;
  invoke: (s: ScheduleRow) => Promise<void>;
  scheduledRunsSince: (since: Date) => Promise<number>;
  dailyCap: number;
}

/** One scheduler tick: run every due schedule once. Returns how many actually ran. */
export async function runOnce(deps: SchedulerDeps): Promise<number> {
  const now = deps.now();
  const due = await deps.dueSchedules(now);
  if (due.length === 0) return 0;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let ran = 0;
  for (const s of due) {
    // Claim the next slot BEFORE running so a slow run can't double-fire next tick.
    await deps.claimNextRun(s.id, nextRun(s.cron, now));

    if ((await deps.scheduledRunsSince(since)) >= deps.dailyCap) {
      console.warn(`scheduler daily cap ${deps.dailyCap} reached; skipping ${s.agent_handle}/${s.skill_slug}`);
      continue;
    }

    try {
      await deps.invoke(s);
      await deps.markRan(s.id, deps.now());
      ran += 1;
    } catch (err) {
      console.error(`scheduled run failed for ${s.agent_handle}/${s.skill_slug}:`, err);
    }
  }
  return ran;
}

export interface LoopOptions {
  delayMs: number;
  signal?: { aborted: boolean };
}

export async function runLoop(deps: SchedulerDeps, opts: LoopOptions): Promise<void> {
  for (;;) {
    if (opts.signal?.aborted) return;
    try {
      const n = await runOnce(deps);
      if (n > 0) console.log(`scheduler fired ${n} runs`);
    } catch (err) {
      console.error("scheduler poll failed, will retry:", err);
    }
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @agenomy/scheduler exec vitest run test/scheduler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Implement src/main.ts** (wires the real pg pool + invoker)

```ts
// apps/scheduler/src/main.ts
import { join } from "node:path";
import { Pool } from "pg";
import {
  dueSchedules,
  claimNextRun,
  markRan,
  countScheduledRunsSince,
  invokeSkillRun,
  type InvokeEnv,
} from "@agenomy/invoker";
import { runLoop } from "./scheduler";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main(): Promise<void> {
  const databaseUrl = reqEnv("DATABASE_URL");
  const env: InvokeEnv = {
    llmBaseUrl: reqEnv("LLM_BASE_URL"),
    llmApiKey: reqEnv("LLM_API_KEY"),
    llmModel: reqEnv("LLM_MODEL"),
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    skillsDir: process.env.SKILLS_DIR || join(process.cwd(), "skills"),
  };
  const delayMs = Number(process.env.SCHEDULER_POLL_MS ?? "60000");
  const dailyCap = Number(process.env.SCHEDULER_DAILY_CAP ?? "500");
  const pool = new Pool({ connectionString: databaseUrl });

  console.log(`scheduler starting: poll=${delayMs}ms dailyCap=${dailyCap} skillsDir=${env.skillsDir}`);
  await runLoop(
    {
      now: () => new Date(),
      dueSchedules: (now) => dueSchedules(pool, now),
      claimNextRun: (id, next) => claimNextRun(pool, id, next),
      markRan: (id, at) => markRan(pool, id, at),
      scheduledRunsSince: (since) => countScheduledRunsSince(pool, since),
      invoke: async (s) => {
        await invokeSkillRun({
          pool,
          handle: s.agent_handle,
          skillSlug: s.skill_slug,
          input: s.input,
          source: "scheduled",
          env,
        });
      },
      dailyCap,
    },
    { delayMs },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @agenomy/scheduler exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/scheduler pnpm-lock.yaml
git commit -m "feat(scheduler): pm2 worker that fires due scheduled runs via shared invoker"
```

---

## Task 10: Schedules UI + scheduled badge

**Files:**
- Create: `apps/web/app/agents/[handle]/SchedulesPanel.tsx`
- Modify: `apps/web/app/agents/[handle]/AgentProfile.tsx` (mount the panel)
- Modify: `apps/web/app/agents/[handle]/InvokePanel.tsx` (scheduled badge)

- [ ] **Step 1: SchedulesPanel.tsx**

```tsx
// apps/web/app/agents/[handle]/SchedulesPanel.tsx
"use client";

import { useEffect, useState } from "react";

interface SkillItem {
  slug: string;
  name: string;
  category: string;
  inputs: string;
}
interface ScheduleRow {
  id: string;
  skill_slug: string;
  input: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
}

const PRESETS: Array<{ key: string; label: string; cron: string }> = [
  { key: "hourly", label: "Hourly", cron: "0 * * * *" },
  { key: "every_6h", label: "Every 6h", cron: "0 */6 * * *" },
  { key: "daily", label: "Daily 09:00", cron: "0 9 * * *" },
  { key: "weekly", label: "Weekly Mon", cron: "0 9 * * 1" },
];
const PRESET_LABELS: Record<string, string> = {
  "0 * * * *": "Hourly",
  "0 */6 * * *": "Every 6 hours",
  "0 9 * * *": "Daily 09:00 UTC",
  "0 9 * * 1": "Weekly (Mon 09:00 UTC)",
};
const cadence = (cron: string) => PRESET_LABELS[cron] ?? cron;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export function SchedulesPanel({ handle }: { handle: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [skill, setSkill] = useState("");
  const [input, setInput] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function load() {
    fetch(`/api/agents/${handle}/schedules`)
      .then((r) => r.json())
      .then((d) => setRows(d.schedules ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/skills/catalog")
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.skills ?? []);
        if (d.skills?.[0]) setSkill(d.skills[0].slug);
      })
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/agents/${handle}/schedules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillSlug: skill, input, cron }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "could not create schedule");
      } else {
        setInput("");
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: ScheduleRow) {
    await fetch(`/api/agents/${handle}/schedules/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    load();
  }

  async function remove(r: ScheduleRow) {
    await fetch(`/api/agents/${handle}/schedules/${r.id}`, { method: "DELETE" });
    load();
  }

  const current = skills.find((s) => s.slug === skill);

  return (
    <section className="card">
      <h2 className="card-label">Schedules</h2>
      <p className="muted-note" style={{ marginTop: 0 }}>
        Runs this agent automatically. Times are UTC. Input is stored once and reused each run.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <select className="field" value={skill} onChange={(e) => setSkill(e.target.value)}>
          {skills.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} ({s.category})
            </option>
          ))}
        </select>
        {current && (
          <p className="muted-note" style={{ margin: 0 }}>
            Input: {current.inputs}
          </p>
        )}
        <input
          className="field"
          placeholder="input reused each run (leave blank if none)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={cron === p.cron ? "btn btn-primary" : "btn btn-ghost"}
              style={{ fontSize: "13px" }}
              onClick={() => setCron(p.cron)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="field mono"
          placeholder="custom cron (UTC), e.g. 0 9 * * 1"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !skill} onClick={create} style={{ alignSelf: "flex-start" }}>
          {busy ? "Saving…" : "Add schedule"}
        </button>
        {err && <p style={{ color: "var(--accent)", margin: 0, fontSize: "13.5px" }}>{err}</p>}
      </div>

      {rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", fontSize: "13.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span className="mono">{r.skill_slug}</span>
                <span className="muted-note">{cadence(r.cron)}</span>
              </div>
              {r.input && <div style={{ color: "var(--ink-soft)" }}>input: {r.input}</div>}
              <div className="muted-note">
                next: {fmt(r.next_run_at)} · last: {fmt(r.last_run_at)} · {r.enabled ? "enabled" : "paused"}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={() => toggle(r)}>
                  {r.enabled ? "pause" : "resume"}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={() => remove(r)}>
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount it in AgentProfile.tsx**

In `apps/web/app/agents/[handle]/AgentProfile.tsx`, add the import next to the InvokePanel import:
```tsx
import { SchedulesPanel } from "./SchedulesPanel";
```
And add the panel directly after `<InvokePanel handle={agent.handle} />`:
```tsx
      <InvokePanel handle={agent.handle} />

      <SchedulesPanel handle={agent.handle} />
```

- [ ] **Step 3: Add the scheduled badge in InvokePanel.tsx**

In `apps/web/app/agents/[handle]/InvokePanel.tsx`, extend the `RunRow` interface with `source`:
```tsx
interface RunRow {
  id: string;
  skill_slug: string;
  input: string;
  status: string;
  output: string | null;
  source?: string;
  started_at: string;
}
```
Then in the recent-runs `<li>`, render a badge after the status span. Replace the status line:
```tsx
                <span style={{ color: r.status === "ok" ? "var(--green)" : "var(--accent)" }}>{r.status}</span>
```
with:
```tsx
                <span style={{ color: r.status === "ok" ? "var(--green)" : "var(--accent)" }}>{r.status}</span>
                {r.source === "scheduled" && (
                  <span className="muted-note" style={{ marginLeft: "6px", fontSize: "11px" }}>
                    · scheduled
                  </span>
                )}
```

- [ ] **Step 4: Build to verify the UI compiles**

Run: `pnpm --filter @agenomy/web build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/agents/[handle]/SchedulesPanel.tsx" "apps/web/app/agents/[handle]/AgentProfile.tsx" "apps/web/app/agents/[handle]/InvokePanel.tsx"
git commit -m "feat(web): Schedules UI card + scheduled badge on runs"
```

---

## Task 11: Deploy to the VPS + verify live

**Files:** none (deploy only)

- [ ] **Step 1: Full local test sweep before shipping**

Run: `pnpm -r test`
Expected: all packages green (runtime, invoker, scheduler, indexer, web if any).

- [ ] **Step 2: Apply migration 003 to the VPS Postgres**

Ship + apply (the VPS runs Postgres in Docker; match the existing apply method used for `002_runs.sql`). Using plink/pscp:
```bash
"/c/Program Files/PuTTY/pscp" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -pw '<vps_pw>' migrations/003_schedules.sql root@13.140.173.196:/tmp/003_schedules.sql
"/c/Program Files/PuTTY/plink" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -ssh -pw '<vps_pw>' root@13.140.173.196 "docker exec -i agenomy-db psql -U postgres -d agenomy < /tmp/003_schedules.sql && docker exec -i agenomy-db psql -U postgres -d agenomy -c '\\d schedules'"
```
Expected: `schedules` table + `schedules_due_idx` listed. (Use the real container name + DB creds from the VPS `.env.local`.)

- [ ] **Step 3: Ship the repo, install, build**

```bash
git archive --format=tar -o /c/tmp/agenomy.tar slice-1-agent-identity
"/c/Program Files/PuTTY/pscp" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -pw '<vps_pw>' /c/tmp/agenomy.tar root@13.140.173.196:/tmp/agenomy.tar
"/c/Program Files/PuTTY/plink" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -ssh -pw '<vps_pw>' root@13.140.173.196 "cd /opt/agenomy && tar -xf /tmp/agenomy.tar && pnpm install && pnpm --filter @agenomy/web build"
```
Expected: install + web build succeed. (Do NOT `rm` first — preserve `.env.local`.)

- [ ] **Step 4: Ensure SKILLS_DIR + LLM env are set for the scheduler, then start it under pm2**

The scheduler needs `DATABASE_URL`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and (recommended) `SKILLS_DIR=/opt/agenomy/skills` in the VPS `.env.local`. Confirm `SKILLS_DIR` is present (add it if missing), then:
```bash
"/c/Program Files/PuTTY/plink" -batch -hostkey "SHA256:QO1Al1MJB4xNBEh1JZXAUykV1JwHGno90SJJUrdkwfc" -ssh -pw '<vps_pw>' root@13.140.173.196 "cd /opt/agenomy && pm2 restart agenomy-web && pm2 start 'pnpm --filter @agenomy/scheduler start' --name agenomy-scheduler --cwd /opt/agenomy && pm2 save && pm2 logs agenomy-scheduler --lines 20 --nostream"
```
Expected: `agenomy-scheduler` shows `scheduler starting: poll=60000ms ...` and no crash. (pm2 loads env from the process; if pm2 doesn't inherit `.env.local`, start it via a small wrapper that sources the env, matching how `agenomy-indexer` is started.)

- [ ] **Step 5: Verify end-to-end live**

Create a schedule that fires within the minute (use a near-future minute in cron, e.g. if it's 10:23 UTC use `24 10 * * *`) on a real agent, then confirm a scheduled run appears:
```bash
curl -s -X POST "https://agenomy.13-140-173-196.sslip.io/api/agents/wizard/schedules" \
  -H "content-type: application/json" \
  -d '{"skillSlug":"base-gas-check","input":"","cron":"24 10 * * *"}'
# wait until the minute passes, then:
curl -s "https://agenomy.13-140-173-196.sslip.io/api/agents/wizard/runs" | python -c "import sys,json;[print(r['source'],r['skill_slug'],r['status']) for r in json.load(sys.stdin)['runs'][:5]]"
```
Expected: a `scheduled base-gas-check ok` row appears. Then delete the throwaway schedule via the UI or DELETE.

- [ ] **Step 6: Sanity-check the cap + min-interval guards**

```bash
curl -s -X POST "https://agenomy.13-140-173-196.sslip.io/api/agents/wizard/schedules" -H "content-type: application/json" -d '{"skillSlug":"base-gas-check","cron":"* * * * *"}'
```
Expected: HTTP 400 `{"error":"schedule must run at most once per hour"}`.

- [ ] **Step 7: Commit any deploy-only config (if a pm2 ecosystem file or env template changed)**

```bash
git add -A
git commit -m "chore(deploy): run agenomy-scheduler pm2 worker on the VPS"
```

---

## Self-review notes (for the implementer)

- **Single execution path:** both `run/route.ts` and `apps/scheduler` call `invokeSkillRun`. Do not reintroduce a second copy of the assembly logic — that would break the no-LARP consistency guarantee.
- **Time:** all cron evaluation is UTC; `next_run_at`/`last_run_at` are real DB values surfaced in the UI.
- **Double-fire:** `claimNextRun` runs before `invoke`, so a run longer than one poll interval cannot be re-selected.
- **Caps:** min-interval enforced at create (`validateCron`), per-agent cap at create (`countSchedules`), global daily cap at run time (`countScheduledRunsSince`).
- **`index.ts` ordering:** `cron.ts` must exist before `schedules.ts` imports `nextRun`; Tasks 4→5 order respects this.
