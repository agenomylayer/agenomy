# Slice 3 — Agent Execution (Design / Spec)

**Status:** approved-in-principle via brainstorming dialogue (2026-06-15), pending written-spec review.
**Goal:** turn a registered Agenomy agent into one that **actually performs real work** — its skills genuinely run (e.g. a "DeFi Monitor" skill really reads on-chain + market data and reports), not faked.

## Principles (hard constraints from the user)
- **No LARP.** Every skill we ship genuinely works; nothing is faked. If a capability isn't backed by a real tool/data source, we don't ship it.
- **Consistent, real-product quality.** Output and copy read like a real product.
- **All-on-VPS.** Everything that *runs* (runtime, tools, skill files, data, credentials) lives on the Contabo VPS. Nothing runs on or depends on the user's computer. (Source code is edited locally then deployed — option A — but runs only on the VPS.)
- **Our own skills.** We author our own skills in an Aeon-style format; we do NOT ship Aeon's skill files. (Aeon validated the *pattern*: a markdown Claude prompt + declared tools + schedule, run by an LLM. We adopt the pattern, author our own content.)
- **Model-agnostic.** The runtime can drive **Claude or MiMo** (or others) by config. Default to Claude for quality; MiMo (Xiaomi, OpenAI-compatible, agentic/tool-use capable) is a swappable option to compare on cost/quality. Exact model IDs + SDK pinned at implementation per the `claude-api` reference.

## Scope (Aeon-level from the start)
A real toolset, **both on-demand and scheduled/autonomous** runs, and a curated catalog of **~30 genuinely-useful skills** across crypto/on-chain, research/intel, content/growth, analysis/productivity, and autonomous digests/alerts. Runtime is model-agnostic (Claude default, MiMo swappable). Skills are cheap to author (mostly prompts) and parallelizable; the real build effort is the runtime + tools + scheduler. **Deferred:** MiMo benchmark/switch decision, X/social tools (X API is paid), and Slice 4 (pay-per-invoke).

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
The runtime exposes a curated set of **real tools** as LLM-callable functions (direct implementations, not MCP — keeps it model-agnostic):
- `onchain_read` — Base (Sepolia) RPC: ETH/token balances, ERC-20 metadata, contract view calls, gas price. (Free; we have `BASE_SEPOLIA_RPC_URL`.)
- `explorer` — richer on-chain data via a free explorer API (Basescan/Blockscout): an address's token balances, recent txs/transfers, recently-deployed tokens. (Free tier.)
- `market_data` — prices, 24h change, TVL, pool/yields, trending, gainers/losers via DeFiLlama (free, no key) + CoinGecko free tier.
- `web_search` — web search + fetch for research/news/sentiment via a free-tier provider (Brave or Tavily). (One free-tier key.)
- (Claude/MiMo alone backs the content/analysis skills — real because the model genuinely produces the work.)

Each tool: a typed function with a JSON-schema signature, a real implementation, input validation, timeouts, structured errors. Adding a tool unlocks a family of skills. (X/social tools deferred — X API is paid.)

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
- **On-demand:** user (or later another agent) POSTs an input + chosen skill to `/api/agents/[handle]/run`; the runner executes; result shown + logged.
- **Scheduled / autonomous:** skills with a `schedule` cron run unattended via a scheduler on the VPS; output appended to the agent's runs/feed. (Aeon's signature: daily digests + alerts.)

### 6. Catalog change
The current 202 imported (descriptive, non-functional) skills are **archived** (kept out of the live picker; the `skills` table gets a `status`/`source` so we can hide them). The picker/galleries show only our **curated real** catalog — a launch set of **~30 genuinely-useful skills**, each backed by a tool or by the model's own work:
- **Crypto / on-chain** (onchain/explorer/market): Wallet Portfolio, Whale Watch, Token Info, New Token Scan, Gas Tracker, NFT Holdings, Price Report, Top Gainers/Losers, Trending Tokens, DeFi Pool Monitor, Yield Finder, Protocol Snapshot, Stablecoin Monitor, Token Screener.
- **Research / intel** (web_search): Project Deep-Dive, Crypto News Digest, Sentiment Scan, Competitor Teardown, Narrative Tracker, Airdrop Finder, Fact Check.
- **Content / growth** (model): Thread-from-Article, Reply Drafter, Tweet Ideas, Hook Writer, Newsletter Draft, Tokenomics Explainer, Growth-Loop Finder.
- **Analysis / productivity** (model): Action Converter, Decision Helper, Risk Assessor, Roadmap Drafter.
- **Autonomous** (scheduled versions): Daily Digest, Watchlist Alert, Gas Alert, Gainers Alert, News Brief.

The catalog grows over time. Each skill is authored in our format and **validated against its declared tools before enabling**; authoring is parallelized with a multi-agent workflow at build time. Every shipped skill genuinely works (no LARP).

### 7. UI
On the agent profile: an **Invoke** panel (pick a skill the agent has → enter input → Run) and a **Runs** list (status, output, expandable trace showing the real tool calls/results). The wizard's skill step now offers only real skills.

## Dependencies (all stored as secrets on the VPS)
- **LLM credential — the one must-have.** Claude Code OAuth token (free within the user's subscription, for now/dev) or `ANTHROPIC_API_KEY`; and/or a **MiMo API key** (WaveSpeed / AI-ML API) if we run MiMo. Runtime reads whichever provider is configured.
- Base RPC: configured (free). DeFiLlama + CoinGecko: free. Explorer API (Basescan/Blockscout): free tier. **`web_search`: one free-tier key** (Brave or Tavily) — for the research/intel skills.

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
