# Slice 3 — Agent Execution (Design / Spec)

**Status:** approved-in-principle via brainstorming dialogue (2026-06-15), pending written-spec review.
**Goal:** turn a registered Agenomy agent into one that **actually performs real work** — its skills genuinely run (e.g. a "DeFi Monitor" skill really reads on-chain + market data and reports), not faked.

## Principles (hard constraints from the user)
- **No LARP.** Every skill we ship genuinely works; nothing is faked. If a capability isn't backed by a real tool/data source, we don't ship it.
- **Consistent, real-product quality.** Output and copy read like a real product.
- **All-on-VPS.** Everything that *runs* (runtime, tools, skill files, data, credentials) lives on the Contabo VPS. Nothing runs on or depends on the user's computer. (Source code is edited locally then deployed — option A — but runs only on the VPS.)
- **Our own skills.** We author our own skills in an Aeon-style format; we do NOT ship Aeon's skill files. (Aeon validated the *pattern*: a markdown Claude prompt + declared tools + schedule, run by an LLM. We adopt the pattern, author our own content.)
- **Model-agnostic.** The runtime can drive **Claude or MiMo** (or others) by config. Default to Claude for quality; MiMo (Xiaomi, OpenAI-compatible, agentic/tool-use capable) is a swappable option to compare on cost/quality. Exact model IDs + SDK pinned at implementation per the `claude-api` reference.

## Scope / decomposition
Slice 3 is large, so it splits:
- **Slice 3a (this spec):** the execution runtime + a real toolset + a first batch of our own real skills + **on-demand** invoke + run records + UI + replace the imported 202-skill catalog with our curated real one. Default model Claude, runtime built model-agnostic.
- **Slice 3b (later):** scheduled/autonomous runs (the `schedule` field), more tools (e.g. web search), more skills, MiMo benchmarking/switch, and prep for Slice 4 (pay-per-invoke).

## Background (grounding)
Today a skill is metadata only (`{slug, name, description, category, tags}`); the 202 came from the Aeon catalog (descriptions, no executable body). An agent's manifest is `{handle, owner, persona, skills:[slug], createdAt}`. So "execution" cannot mean "run the skill's code" — there is none. It means: an LLM, prompted with the agent's persona + the chosen skill's instructions, using **real tools**, performs a task and returns a real, verifiable result.

## Architecture

### 1. Skill format (ours)
Each skill is a file in the repo (e.g. `skills/<slug>/skill.md`) with frontmatter + a prompt:
```
---
slug: defi-monitor
name: DeFi Monitor
category: onchain
tools: [onchain_read, market_data]   # which real tools this skill may call
inputs: "A token symbol/address, pool, or wallet on Base"
schedule: null                        # cron string for 3b autonomous runs; null = on-demand only
---
You are <persona>. Your job: check the health/positions/yield for the given target.
Use onchain_read + market_data to fetch REAL data. Never invent numbers; ground every
figure in a tool result. Report clearly and concisely. If data is unavailable, say so.
```
Skill files are authored by us, validated (frontmatter schema + declared tools must exist), and synced into the DB catalog. The prompt is parameterized with the agent's persona at runtime.

### 2. Real toolset (the foundation — this is what makes it real)
The runtime exposes a curated set of **real tools** as LLM-callable functions (direct implementations, not MCP — keeps it model-agnostic). Starter set for 3a:
- `onchain_read` — Base (Sepolia) RPC reads: balances, ERC-20 token info, contract calls. (Free; we already have `BASE_SEPOLIA_RPC_URL`.)
- `market_data` — token prices / DeFi pool & yield data via DeFiLlama (free, no key) and/or CoinGecko free tier.
- (Claude/MiMo itself needs no tool for content/analysis skills — those are real because the model genuinely produces the work.)
- `web_search` — deferred to 3b (needs a free-tier key, e.g. Brave/Tavily).

Each tool: a typed function with a JSON-schema signature, a real implementation, input validation, timeouts, and error handling that returns a structured error the model can react to. Adding a tool unlocks a new family of skills.

### 3. Runtime (model-agnostic agent loop)
A new service/module on the VPS, `runner`, exposes `invoke(agentHandle, skillSlug, input) -> Run`:
1. Load the agent (persona, owns the skill) + the skill (prompt + allowed tools) + resolve the system prompt.
2. Run a **tool-use loop** against an OpenAI-compatible chat/completions interface (a thin provider adapter: Claude via the Anthropic API/adapter, MiMo via its OpenAI-compatible endpoint; an abstraction like liteLLM or a small in-house adapter). The model may call the skill's allowed tools; we execute them, feed results back, until it produces a final answer or hits a step/`maxTokens`/time cap.
3. Persist a **Run** with the full trace (so anyone can verify it used real tools).
Bounds: per-run step cap, token cap, wall-clock timeout, and a global daily budget guard to control LLM cost.

### 4. Runs (data model)
New table `runs` (migration `002_runs.sql`):
`id, agent_handle, skill_slug, input, status (running|ok|error), output, trace (jsonb: tool calls + results + model steps), model, tokens_in, tokens_out, started_at, finished_at, error`.
Indexed by `agent_handle`. Read API: `GET /api/agents/[handle]/runs`, `GET /api/runs/[id]`. Write: `POST /api/agents/[handle]/run` (triggers a run; returns the run id; the runner executes).

### 5. Triggers
- **3a — on-demand:** user (or later another agent) POSTs an input to `/api/agents/[handle]/run` with a chosen skill; the runner executes; result shown + logged.
- **3b — scheduled/autonomous:** a scheduler on the VPS runs skills with a `schedule` cron, unattended; output appended to the agent's runs/feed.

### 6. Catalog change
The current 202 imported (descriptive, non-functional) skills are **archived** (kept out of the live picker; the `skills` table gets a `status`/`source` so we can hide them). The create wizard + galleries show only our **curated real** skills. Start with a **first batch of ~6–10 skills** authored across categories (Content via the model alone; On-chain + Market via the tools above); grow over time. Authoring the batch can be parallelized with a multi-agent workflow at build time (each agent drafts a skill in our format; we then validate every one against its declared tools before enabling).

### 7. UI
On the agent profile: an **Invoke** panel (pick a skill the agent has → enter input → Run) and a **Runs** list (status, output, expandable trace showing the real tool calls/results). The wizard's skill step now offers only real skills.

## Dependencies (all stored as secrets on the VPS)
- **LLM credential — the one must-have.** Claude Code OAuth token (free within the user's subscription, for now/dev) or `ANTHROPIC_API_KEY`; and/or a **MiMo API key** (WaveSpeed / AI-ML API) if we run MiMo. Runtime reads whichever provider is configured.
- Base RPC: already configured (free). DeFiLlama: free, no key. `web_search` key: deferred to 3b.

## No-LARP guardrails
- Only skills whose declared tools exist + work are enabled.
- The model is instructed to ground all factual claims in tool results; the full **run trace** (tool calls + raw results) is stored and viewable, so any output can be independently verified.
- Honest empty/error states ("data unavailable") instead of fabrication.

## Testing
- Unit: skill-file parsing/validation; system-prompt assembly; each tool (mocked HTTP/RPC); the tool-loop controller (mocked model, asserting tool dispatch + termination + caps); run persistence.
- Integration: one tool against a known Base Sepolia value; one end-to-end run with a mocked model + real tools.
- Manual: invoke a real skill (e.g. DeFi Monitor) against a real target and verify the trace shows real tool data. Verify with both Claude and (later) MiMo.
- Web build: `tsc` clean + existing 60 tests stay green; new unit tests added.

## Deployment (all on VPS)
The runner + tools + skill files + new API routes deploy the same way as Slice 2 (git archive → VPS → build → pm2). The runner runs as a pm2 process (or inside the web app's API routes if light enough — decided at planning). LLM/MiMo credentials added to the VPS env (gitignored). Nothing runs locally.

## Open questions / risks (resolve in planning)
- Runner as a separate pm2 service vs in-process API route (depends on run duration; long runs → separate worker + job queue).
- Exact provider adapter (liteLLM vs a minimal in-house OpenAI-compatible client) — pin during planning per `claude-api`.
- MiMo agentic reliability is unverified for our tasks → benchmark before defaulting to it.
- Cost control: daily budget guard + per-run caps must be in 3a.
