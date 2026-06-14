# Slice 3 / Plan 4 — Scheduler (Autonomous Scheduled Runs) Design

**Status:** Approved 2026-06-15
**Parent spec:** `docs/superpowers/specs/2026-06-15-slice3-execution-design.md` (section 5 "Triggers", the `schedule` field)
**Builds on:** Plan 1 (foundation), Plan 2 (runtime + on-demand runs, live)

## Goal

Let an agent run a skill **on a recurring schedule, unattended** — no human clicking "Run". This is what turns "autonomous AI worker" from tagline into a real capability. A scheduled run is the same execution as an on-demand run; only the trigger differs.

Scope is deliberately **lean**: recurring runs with a stored input + cost guards. Full autonomy (agents self-managing budget/gas, event-triggered runs) stays in Roadmap 3, per `docs/ROADMAP.md`.

## Decisions (resolved during brainstorm)

1. **Any skill is schedulable, uniformly.** No allowlist. A schedule is a `(agent, skill, stored input, cron)` tuple. Skills that need input get their input stored once by the owner; no-input skills (e.g. `base-gas-check`) store an empty input. Data-pull skills (gas/balance/price/TVL/holdings) make genuinely useful recurring monitors because the underlying data changes; content/analysis skills with a static input will repeat similar output but still execute for real (not LARP). We do not restrict in code.
2. **Both presets and raw cron** for the schedule UI. Presets map to cron strings under the hood; an advanced raw-cron field is also available. Everything is stored and evaluated as a cron expression.
3. **Separate pm2 worker process** (`apps/scheduler`), modeled exactly on the existing indexer poll loop. Isolated from the web app; restarts independently; no impact on web latency.
4. **One shared execution path.** A new `@agenomy/invoker` package holds the single `invokeSkillRun(...)` function used by BOTH the on-demand web route and the scheduler. A scheduled run is byte-for-byte the same code path as a manual run. No drift, no LARP.
5. **Cost guards** because the user's MiMo key pays: minimum interval 1 hour, max 10 schedules per agent, plus a global daily scheduled-run cap (default **500 runs / 24h**) as an emergency brake. Per-run caps (maxSteps, wall-clock) already exist in the runtime. The cap value is read from env (`SCHEDULER_DAILY_CAP`, default 500) so it is tunable without a redeploy.

## Non-goals (out of scope for this plan)

- Autonomous budget/gas self-management by agents (Roadmap 3).
- Event-triggered or agent-to-agent triggers (Roadmap 3).
- External notifications (email/Telegram/webhook) on scheduled output. Output lands in the existing Runs list; notifications are a later slice.
- Owner-only auth gating on schedule create/delete. The on-demand `/run` route is currently unauthenticated; schedules stay consistent with that posture and are protected by the cost caps instead. (Auth is a cross-cutting later concern.)

## Data model (migration `003_schedules.sql`)

New table `schedules`:

| column | type | notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `agent_handle` | TEXT NOT NULL | the agent that owns the schedule |
| `skill_slug` | TEXT NOT NULL | skill to run (from the live catalog) |
| `input` | TEXT NOT NULL DEFAULT '' | stored input reused each run; '' for no-input skills |
| `cron` | TEXT NOT NULL | cron expression (UTC) |
| `enabled` | BOOLEAN NOT NULL DEFAULT true | |
| `last_run_at` | TIMESTAMPTZ | null until first run |
| `next_run_at` | TIMESTAMPTZ NOT NULL | computed from cron at create + after each run |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Index: `(enabled, next_run_at)` for the due-query.

Extend `runs` (same migration): add `source TEXT NOT NULL DEFAULT 'manual'` (`'manual' | 'scheduled'`) so scheduled runs are honestly labelled in the UI.

## Components

### 1. `@agenomy/invoker` (new package) — the single execution path

`invokeSkillRun(opts): Promise<RunAgentResult & { runId }>` where opts =
`{ pool, handle, skillSlug, input, env, source }`.

Responsibilities (extracted verbatim from the current web run route so behavior is identical):
- Load persona: `SELECT persona FROM agents WHERE handle = $1` (live persona each run).
- Load skill from `SKILLS_DIR` via `loadSkillsFromDir` + pick `skillSlug` (404 semantics → throw a typed error).
- Build registry `[onchainRead, marketData]` and provider from `env` (LLM_BASE_URL/LLM_API_KEY/LLM_MODEL), toolCtx `{ rpcUrl: BASE_SEPOLIA_RPC_URL, fetch }`.
- `createRun(handle, skillSlug, input, source)` → `runAgent(...)` → `finishRun(runId, {...})`.
- Returns the run result + runId.

The runs DB helpers (`createRun`/`finishRun`/`listRuns`) move into (or are imported by) this package so both apps share them. `createRun` gains a `source` parameter (default `'manual'`).

`apps/web/.../run/route.ts` is refactored to call `invokeSkillRun({ ..., source: 'manual' })` — same observable behavior, now one shared function.

### 2. `apps/scheduler` (new pm2 worker) — modeled on `apps/indexer`

`src/main.ts`: load env, construct a pg Pool, call `runLoop`.
`src/scheduler.ts`:
- `runOnce(pool, env, now)`: `SELECT * FROM schedules WHERE enabled AND next_run_at <= now()`. For each due schedule:
  1. Compute the next fire time from `cron` and `UPDATE next_run_at` **first** (claim it, prevents double-fire across ticks).
  2. `invokeSkillRun({ pool, handle, skillSlug, input, env, source: 'scheduled' })`.
  3. `UPDATE last_run_at = now()`.
  4. On error: the run is recorded as `status='error'` by the invoker (same as manual); the loop continues to the next schedule.
- `runLoop(pool, env, delayMs = 60_000)`: `runOnce` every 60s forever (same shape as `indexer.runLoop`).
- Global daily cap: before invoking, check count of `source='scheduled'` runs in the last 24h; if over the cap, skip + log (emergency brake).

### 3. Cron handling (`cron-parser`)

- Preset → cron map (UTC): Hourly `0 * * * *`, Every 6h `0 */6 * * *`, Daily 09:00 `0 9 * * *`, Weekly Mon 09:00 `0 9 * * 1`.
- `nextRun(cron, from)` via `cron-parser` → used at create and after each run.
- `validateCron(cron)`: parseable AND the gap between the next two fire times ≥ 1 hour (rejects sub-hourly abuse). Used by the create API.

### 4. API routes (`apps/web`)

- `GET /api/agents/[handle]/schedules` → list schedules for the agent.
- `POST /api/agents/[handle]/schedules` → body `{ skillSlug, input, cron }`. Validates: skill exists in catalog, cron valid + ≥1h, agent under the 10-schedule cap. Computes `next_run_at`, inserts.
- `PATCH /api/agents/[handle]/schedules/[id]` → toggle `enabled`.
- `DELETE /api/agents/[handle]/schedules/[id]` → remove.

### 5. UI (`apps/web`, agent profile)

New "Schedules" card (client component, next to "Run a skill"):
- List existing schedules: skill name, cadence label, input preview, last run, next run, enable/disable toggle, delete. Cadence label = the friendly preset name when `cron` matches a known preset (matched against the preset map, no extra column); otherwise the raw cron string is shown (no general cron humanizer in MVP).
- "New schedule" form: pick skill (same catalog dropdown as Invoke) → input field (with the skill's `inputs` hint) → cadence picker (preset buttons + "Custom cron" field) → Create.
- The existing Runs list gains a small "scheduled" badge on rows where `source='scheduled'`.

Times shown as UTC with an explicit "UTC" label (no timezone conversion in MVP).

## Consistency / no-LARP guarantees

- Scheduled and manual runs go through the **same** `invokeSkillRun` — identical tools, identical trace, identical persistence. A scheduled run is not a simulation.
- The schedule UI only offers skills from the **live catalog** (the 14 real skills), same source as the Invoke panel — web features match what actually runs.
- `next_run_at` / `last_run_at` shown in the UI are the real DB values the worker uses, not decorative.
- Scheduled runs are explicitly badged; we never pass off a scheduled run as something it isn't.

## Testing (vitest)

- `@agenomy/invoker`: with a mock pool + mock provider fetch, asserts a run row is created then finished with the right status/trace; persona + skill loaded; `source` threaded through.
- `apps/scheduler`: `nextRun` correctness for each preset; `runOnce` selects only due+enabled schedules; a due schedule triggers `invokeSkillRun` (mocked) and updates `next_run_at`/`last_run_at`; daily-cap short-circuit.
- Cron validation: presets pass; sub-hourly (`* * * * *`) rejected; garbage rejected.
- Web route refactor: existing run-route test still green against the shared invoker.

## Deploy

- Apply `003_schedules.sql` to VPS Postgres.
- Add `cron-parser` dependency (web + scheduler).
- Build all packages; start a 3rd pm2 process `agenomy-scheduler` (`apps/scheduler`), same env loading as the indexer (`.env.local`).
- Verify live: create a schedule via the API/UI, confirm the worker fires it within the minute window and a `source='scheduled'` run appears in the Runs list.
