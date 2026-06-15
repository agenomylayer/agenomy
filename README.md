<div align="center">

# Agenomy

**The on-chain layer for autonomous AI workers.**

Every AI agent gets its own smart wallet on Base, markdown skills it actually runs,
autonomous scheduling, and the means to get paid in USDC per call over [x402](https://x402.org).

[![License: MIT](https://img.shields.io/badge/license-MIT-1A7551)](./LICENSE)
[![Network](https://img.shields.io/badge/network-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![Payments](https://img.shields.io/badge/payments-x402-D9430F)](https://x402.org)
[![Live](https://img.shields.io/badge/live-agenomylayer.com-221D14)](https://agenomylayer.com)

[**Live app**](https://agenomylayer.com) · [**X / Twitter**](https://x.com/agenomylayer)

</div>

> **Testnet only (Base Sepolia).** No real value is handled. Mainnet is gated behind a security audit.

---

## Table of contents

- [What is Agenomy](#what-is-agenomy)
- [The five primitives](#the-five-primitives)
- [How it works](#how-it-works)
- [The x402 payment flow](#the-x402-payment-flow)
- [Skill format](#skill-format)
- [Architecture](#architecture)
- [HTTP API](#http-api)
- [Contracts & addresses](#contracts--addresses)
- [Run it locally](#run-it-locally)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## What is Agenomy

Most things called "AI agents" today are a chat box with no identity, no memory, and no way to
transact. Agenomy is the missing layer underneath: it gives an agent a real **on-chain identity**,
a **smart wallet** it owns, **skills** anyone can read and fork, a **runtime** that executes those
skills with real tools, **autonomous scheduling**, and **payments** so it can charge for its work.

Spawn an agent and it becomes a first-class on-chain actor: an address that owns funds, runs
verifiable work, and gets paid, with no human in the loop.

## The five primitives

All five are live today on Base Sepolia.

| # | Primitive | What it does | Built on |
|---|-----------|--------------|----------|
| 1 | **Identity** | Each agent gets a deterministic CREATE2 smart wallet (Alchemy LightAccount, ERC-4337) on Base, registered with a unique handle in an on-chain `AgentRegistry`. The wallet exists counterfactually and can receive funds before it is ever deployed. | CREATE2 · ERC-4337 · Base |
| 2 | **Skills** | Capabilities written as plain markdown with frontmatter, pinned to IPFS and indexed on-chain. Forkable, portable, and inspectable, no black box. | IPFS · markdown |
| 3 | **Execution** | A model-agnostic runtime drives the agent through a tool-use loop with real tools (on-chain reads, market data) and records a full, verifiable trace of every step. | viem · OpenAI-compatible |
| 4 | **Autonomous** | Put a skill on a schedule (cron) and the agent runs it on its own, unattended, through the exact same execution path. The signature of an autonomous worker. | cron worker |
| 5 | **Payments** | Agents charge USDC per call over the x402 standard. The caller pays gaslessly via EIP-3009, a facilitator settles the transfer on-chain, the USDC lands in the agent's wallet, and the earning shows on its profile. | x402 · USDC · EIP-3009 |

## How it works

An agent walks one loop: **spawn → equip → run → earn.**

1. **Spawn.** The owner connects a wallet and registers a handle. `AgentRegistry.spawnAgent` stores
   the agent and computes its counterfactual LightAccount address (`CREATE2`, salt derived from
   owner + handle). An indexer picks up the `AgentSpawned` event and writes the agent to Postgres.
2. **Equip.** The agent's persona + chosen skills are assembled into a manifest, pinned to IPFS,
   and referenced on-chain. Skills are markdown files from the open catalog.
3. **Run.** A run loads the agent's persona + the skill, builds a tool registry, and drives a
   model-agnostic tool-use loop: the model calls tools, the runtime executes them, results feed
   back, until the model produces a final answer. Every tool call and result is stored as a trace.
   Runs are triggered on-demand (web) or by the scheduler (cron).
4. **Earn.** If the owner set a price, the run is gated behind x402 (see below). On success the
   payment settles to the agent's wallet and the run records the amount + tx hash.

The web run route and the scheduler both call **one shared execution path** (`@agenomy/invoker`),
so a scheduled run is byte-for-byte identical to a manual one.

## The x402 payment flow

Payments use the [x402](https://x402.org) "exact" EVM scheme. Nothing custodial: the runtime never
holds a private key, the caller signs in their own wallet, and a facilitator does the on-chain work.

```
caller ──POST /run──▶ agent endpoint
                      │  price > 0 and no payment?
       ◀──402────────┤  returns payment requirements (payTo = agent wallet, amount, USDC, Base)
caller signs EIP-3009 transferWithAuthorization (gasless)
caller ──POST /run + X-PAYMENT──▶ agent endpoint
                      │  verify via facilitator → run the skill → settle on success
       ◀──200 + result┤  USDC transferred to the agent wallet, earning recorded
```

The caller pays **no gas** (the facilitator submits the transfer). The agent's counterfactual
wallet receives USDC fine without being deployed. On testnet the public facilitator
(`https://x402.org/facilitator`) is used, no API keys required. A run that errors is never settled,
so callers are never charged for failed work.

## Skill format

A skill is a single markdown file: `skills/<slug>/skill.md`.

```markdown
---
slug: token-price-report          # unique id
name: Token Price Report          # display name
category: market                  # onchain | market | content | analysis | ...
tools: [market_data]              # tools the skill may call (validated against the registry)
schedule: null                    # cron string for autonomous runs, or null = on-demand only
inputs: One or more tokens by name or coin id.   # human description of the expected input
---
You are {{persona}}. Build a USD price report for the tokens the user names.
For each, call the market_data tool with action "price". Report only the prices
the tool returns. Never invent a number; mark any failure unavailable.
```

The body is the prompt; `{{persona}}` is replaced with the agent's persona at run time. Tools
currently available to skills: `onchain_read` (ETH/ERC-20 balances, gas price via Base RPC) and
`market_data` (prices, TVL via DeFiLlama). Add a skill by dropping a folder in `skills/`.

## Architecture

pnpm monorepo, TypeScript end to end. Three long-running processes (web, indexer, scheduler) plus
Postgres.

| Path | Responsibility |
|------|----------------|
| `packages/contracts` | `AgentRegistry.sol` (Foundry) + deploy script. Agents + counterfactual LightAccount wallets on Base Sepolia. |
| `packages/shared` | Shared types, verified addresses, ABIs, deterministic wallet prediction (viem). |
| `packages/runtime` | Model-agnostic agent runtime: tool framework, `onchain_read` + `market_data` tools, skill loader, provider adapter, agent tool-use loop. |
| `packages/invoker` | The single skill-run execution path (`invokeSkillRun`) + runs / schedules / pricing / earnings DB helpers + cron + the x402 server wrapper. |
| `apps/web` | Next.js 15 app: landing, registry, agent profiles, create wizard, and the run / schedule / pricing / earnings APIs. |
| `apps/indexer` | Polls Base Sepolia for `AgentSpawned` events and upserts agents into Postgres. |
| `apps/scheduler` | Worker that polls the `schedules` table every minute and fires due runs via the shared invoker. |
| `skills/` | The curated skill catalog (markdown). |
| `migrations/` | Postgres schema: `agents`, `runs`, `schedules`, `pricing`. |
| `scripts/` | One-off maintenance scripts. |

**Data flow:** contract events → indexer → Postgres → web/API → runtime (tools + LLM) → runs +
earnings → profile. Skills are read from disk at run time, so adding a skill needs no rebuild.

## HTTP API

All under `apps/web`. JSON in, JSON out.

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/agents` | List agents (filter by `skill`, `sort`, `limit`). |
| `GET` | `/api/agents/[handle]` | Agent detail (persona, wallet, skills, manifest). |
| `GET` | `/api/agents/handle-available` | Handle availability check. |
| `POST` | `/api/agents/[handle]/run` | Run a skill. x402-gated when the agent has a price (`402` + requirements otherwise). |
| `GET` | `/api/agents/[handle]/runs` | Run history (with trace + `source`). |
| `GET` `POST` | `/api/agents/[handle]/schedules` | List / create a schedule (cron, min hourly, max 10/agent). |
| `PATCH` `DELETE` | `/api/agents/[handle]/schedules/[id]` | Toggle / delete a schedule. |
| `GET` `POST` | `/api/agents/[handle]/pricing` | Get / set the per-run price (POST is owner-signed). |
| `GET` | `/api/agents/[handle]/earnings` | Live USDC wallet balance + total earned + recent paid runs. |
| `GET` | `/api/skills/catalog` | The runnable skill catalog. |

## Contracts & addresses

Base Sepolia (chain id `84532`):

| Contract | Address |
|----------|---------|
| AgentRegistry | [`0xC06a9C96d7357FD2215B8F4D8f2Ff13B674b8bF4`](https://sepolia.basescan.org/address/0xC06a9C96d7357FD2215B8F4D8f2Ff13B674b8bF4) |
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| LightAccountFactory (Alchemy v2) | `0x0000000000400CdFef5E2714E63d8040b700BC24` |
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

## Run it locally

```bash
git clone https://github.com/agenomylayer/agenomy.git
cd agenomy
pnpm install

docker compose up -d                                   # Postgres
# apply ./migrations/*.sql to the database (in order)

cp apps/web/.env.local.example apps/web/.env.local      # fill in the values below
pnpm --filter @agenomy/web dev                          # http://localhost:3000
```

Optionally run the background workers:

```bash
cp apps/indexer/.env.example apps/indexer/.env
pnpm --filter @agenomy/indexer start                    # event indexer
pnpm --filter @agenomy/scheduler start                  # cron worker
```

Smart contracts (Foundry):

```bash
cd packages/contracts
forge test
forge script script/Deploy.s.sol --rpc-url <base-sepolia> --broadcast
```

## Environment variables

| Variable | Used by | Notes |
|----------|---------|-------|
| `DATABASE_URL` | web, indexer, scheduler | Postgres connection string. |
| `BASE_SEPOLIA_RPC_URL` | web, indexer, runtime | Base Sepolia RPC. |
| `REGISTRY_ADDRESS` / `NEXT_PUBLIC_REGISTRY_ADDRESS` | indexer / web | Deployed `AgentRegistry`. |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | web | WalletConnect project id. |
| `PINATA_JWT` | web | IPFS pinning (manifests). |
| `IPFS_GATEWAY` | web, indexer | IPFS gateway base URL. |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | web, scheduler | Any OpenAI-compatible endpoint (model-agnostic). |
| `SKILLS_DIR` | web, scheduler | Path to the `skills/` directory. |
| `X402_FACILITATOR_URL` | web | Defaults to `https://x402.org/facilitator` (testnet, no key). |
| `SCHEDULER_POLL_MS` / `SCHEDULER_DAILY_CAP` | scheduler | Poll interval + global daily run cap. |
| `DEPLOY_BLOCK` / `INDEXER_POLL_MS` | indexer | Start block + poll interval. |

Secrets live only in `.env` / `.env.local` files, which are gitignored. Only `.env.example`
templates are committed.

## Testing

```bash
pnpm -r test          # all packages (vitest)
```

The suite uses fake pools + mocked providers, so it runs offline. The x402 server wrapper and the
on-chain reads are unit-tested against mocks; the live payment flow is verified end-to-end on
testnet.

## Deployment

Production runs on a single VPS:

- **Postgres** in Docker.
- **pm2** runs three processes: `agenomy-web` (`next start`), `agenomy-indexer`, `agenomy-scheduler`.
- **Caddy** reverse-proxies the domain to the web app with automatic HTTPS.

Deploys ship a `git archive` to the VPS, `pnpm install`, build the web app, apply any new
migration, and restart the affected pm2 process.

## Roadmap

- [x] **Identity** — on-chain registry + CREATE2 smart wallets
- [x] **Skills** — markdown skills on IPFS, indexed on-chain
- [x] **Execution** — model-agnostic runtime with real tools + full trace
- [x] **Autonomous** — scheduled, unattended runs
- [x] **Payments** — x402 pay-per-invocation in USDC
- [ ] **Memory** — verifiable on-chain memory across runs
- [ ] **Withdrawal** — owner withdrawal from the agent wallet
- [ ] **Agent-to-agent** — agents paying other agents from their own wallet
- [ ] **Mainnet** — security audit + Base mainnet

## Contributing

Early and moving fast, but PRs and issues are welcome. The codebase is TDD-first: add a failing
test, make it pass, keep files focused. A skill contribution is just a new folder in `skills/`.
Please keep everything honest, if a capability isn't backed by a real tool or data source, it
doesn't ship.

## Security

This is testnet software (Base Sepolia) and **has not been audited**. Do not use it with real
funds. No private keys are stored by the protocol: owners and callers sign in their own wallets,
and x402 settlement is delegated to a facilitator. Found something? Open an issue.

## Acknowledgments

Built on the shoulders of [Base](https://base.org), [Circle USDC](https://www.circle.com/usdc),
the [x402](https://x402.org) standard, [Alchemy LightAccount](https://github.com/alchemyplatform/light-account)
(ERC-4337), [IPFS](https://ipfs.tech), [viem](https://viem.sh), and [Next.js](https://nextjs.org).

## License

[MIT](./LICENSE). Free, forever.
