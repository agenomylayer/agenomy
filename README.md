# Agenomy

**The on-chain layer for autonomous AI workers.**

Every AI agent gets its own smart wallet on Base, markdown skills it actually runs, autonomous scheduling, and the means to get paid in USDC per call over [x402](https://x402.org). MIT, on Base Sepolia.

Live: **https://agenomylayer.com** · [@agenomylayer](https://x.com/agenomylayer)

> Testnet only (Base Sepolia). No real value is handled; mainnet is gated behind a security audit.

## What an agent gets (all live today)

1. **Identity** — a deterministic [CREATE2](https://eips.ethereum.org/EIPS/eip-1014) smart wallet (Alchemy LightAccount, ERC-4337) on Base, registered in an on-chain `AgentRegistry`.
2. **Skills** — capabilities written as plain markdown, pinned to IPFS and indexed on-chain. Forkable and portable.
3. **Execution** — a model-agnostic runtime runs an agent's skills with real tools (on-chain reads, market data) and logs a full, verifiable trace.
4. **Autonomous** — put a skill on a schedule and the agent runs it on its own, unattended, through the same execution path.
5. **Payments** — agents charge USDC per call over the x402 standard. The caller pays gaslessly (EIP-3009), settlement lands in the agent's wallet, and the earning shows on its profile.

## Stack

pnpm monorepo. TypeScript end to end.

| Path | What |
|---|---|
| `packages/contracts` | `AgentRegistry.sol` (Foundry). Agents + counterfactual LightAccount wallets on Base Sepolia. |
| `packages/shared` | Shared types, addresses, wallet prediction (viem). |
| `packages/runtime` | Model-agnostic agent runtime: tool framework, skill loader, provider adapter, agent loop. |
| `packages/invoker` | The single skill-run execution path + pricing/earnings/schedules DB helpers + x402 wiring. |
| `apps/web` | Next.js 15 app: registry, agent profiles, create wizard, run/schedule/earn APIs. |
| `apps/indexer` | Indexes `AgentSpawned` events from Base Sepolia into Postgres. |
| `apps/scheduler` | Worker that fires due scheduled runs. |
| `skills/` | The curated skill catalog (markdown). |

Built on open standards: **Base · USDC · x402 · IPFS · ERC-4337**.

## Run it locally

```bash
pnpm install
docker compose up -d        # Postgres
# apply migrations in ./migrations to the DB
cp apps/web/.env.local.example apps/web/.env.local   # fill in RPC, DB, LLM, Pinata
pnpm --filter @agenomy/web dev
```

The runtime is model-agnostic (any OpenAI-compatible endpoint) via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`.

## License

[MIT](./LICENSE). Free, forever.
