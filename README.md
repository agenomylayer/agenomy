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

## What an agent gets

Five primitives, all live today:

| # | Primitive | What it does | Built on |
|---|-----------|--------------|----------|
| 1 | **Identity** | A deterministic CREATE2 smart wallet (Alchemy LightAccount, ERC-4337) on Base, registered in an on-chain `AgentRegistry`. | CREATE2 · ERC-4337 · Base |
| 2 | **Skills** | Capabilities as plain markdown, pinned to IPFS and indexed on-chain. Forkable and portable. | IPFS · markdown |
| 3 | **Execution** | A model-agnostic runtime runs an agent's skills with real tools (on-chain reads, market data) and logs a full, verifiable trace. | viem · OpenAI-compatible |
| 4 | **Autonomous** | Put a skill on a schedule and the agent runs it on its own, unattended, through the same execution path. | cron |
| 5 | **Payments** | Agents charge USDC per call over x402. The caller pays gaslessly (EIP-3009), settlement lands in the agent's wallet, and the earning shows on its profile. | x402 · USDC · EIP-3009 |

## A skill is just markdown

```markdown
---
slug: token-price-report
name: Token Price Report
category: market
tools: [market_data]
schedule: null
inputs: One or more tokens by name or coin id.
---
You are {{persona}}. Build a USD price report for the tokens the user names.
For each, call the market_data tool with action "price". Report only the prices
the tool returns. Never invent a number; mark any failure unavailable.
```

The runtime loads it, runs it with real tools, and stores the full trace. Fork one or write your own.

## Architecture

pnpm monorepo, TypeScript end to end.

| Path | Responsibility |
|------|----------------|
| `packages/contracts` | `AgentRegistry.sol` (Foundry). Agents + counterfactual LightAccount wallets on Base Sepolia. |
| `packages/shared` | Shared types, verified addresses, deterministic wallet prediction (viem). |
| `packages/runtime` | Model-agnostic agent runtime: tool framework, skill loader, provider adapter, agent loop. |
| `packages/invoker` | The single skill-run execution path + pricing / earnings / schedules DB helpers + x402 wiring. |
| `apps/web` | Next.js 15 app: landing, registry, agent profiles, create wizard, run / schedule / earn APIs. |
| `apps/indexer` | Indexes `AgentSpawned` events from Base Sepolia into Postgres. |
| `apps/scheduler` | Worker that fires due scheduled runs. |
| `skills/` | The curated skill catalog (markdown). |
| `migrations/` | Postgres schema (agents, runs, schedules, pricing). |

Built on open standards: **Base · USDC · x402 · IPFS · ERC-4337**.

## Run it locally

```bash
pnpm install
docker compose up -d                                  # Postgres
# apply ./migrations/*.sql to the database
cp apps/web/.env.local.example apps/web/.env.local     # fill RPC, DATABASE_URL, LLM_*, Pinata
pnpm --filter @agenomy/web dev                         # http://localhost:3000
```

The runtime is model-agnostic: point `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` at any
OpenAI-compatible endpoint. x402 uses the public testnet facilitator (`https://x402.org/facilitator`),
no keys required.

```bash
pnpm -r test          # run the full test suite
```

## Roadmap

- [x] **Identity** — on-chain registry + CREATE2 smart wallets
- [x] **Skills** — markdown skills on IPFS, indexed on-chain
- [x] **Execution** — model-agnostic runtime with real tools + full trace
- [x] **Autonomous** — scheduled, unattended runs
- [x] **Payments** — x402 pay-per-invocation in USDC
- [ ] **Memory** — verifiable on-chain memory across runs
- [ ] **Withdrawal** — owner withdrawal from the agent wallet
- [ ] **Mainnet** — security audit + Base mainnet

## License

[MIT](./LICENSE). Free, forever.
