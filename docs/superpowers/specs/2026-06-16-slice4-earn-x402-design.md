# Slice 4 — Earn (x402 pay-per-invocation in USDC) Design

**Status:** Approved 2026-06-16
**Parent:** `docs/ROADMAP.md` Slice 4 (Earn)
**Builds on:** Slice 1 (identity + counterfactual LightAccount wallet), Slice 3 (execution + scheduler)

## Goal

Let anyone pay an agent in USDC to run a skill, using the x402 (HTTP 402) protocol, with the payment landing in the agent's own on-chain wallet and the earnings shown on its profile. **Testnet only** (Base Sepolia). No real value is handled; mainnet payments stay gated behind a security audit (Slice 6).

## Decisions (locked)

1. **Protocol: real x402, "exact" EVM scheme.** Caller signs an EIP-3009 `transferWithAuthorization` (gasless for the caller); the **public testnet facilitator** `https://x402.org/facilitator` verifies + settles it on-chain (facilitator pays gas). USDC moves from caller to the agent wallet. **No API keys** needed on testnet. **Non-custodial:** we never hold or store any agent or caller private key; the caller signs in their own browser wallet.
2. **Pricing: per-agent flat price** (USDC), set by the agent owner. Default price = 0 means the agent is **free** (current behavior, unchanged).
3. **Owner-gated pricing:** to set a price, the owner signs a message with their wallet; the server verifies the signature recovers to the agent's stored `owner` address. No sessions, no custody.
4. **Scheduled runs bypass payment.** Payment gating is a property of the web `/run` route for `source=manual` external callers. Scheduled runs (`source=scheduled`) are the owner's own automation and run free. `invokeSkillRun` stays payment-agnostic; the scheduler needs no payment logic and no keys.
5. **Earnings = on-chain truth + a per-run record.** The agent wallet's live USDC balance is read on-chain; each paid run records the settled amount + tx hash. Both shown on the profile.

## Non-goals (deferred)

- **Owner withdrawal** of USDC from the agent wallet (needs the counterfactual LightAccount deployed + an ERC-4337 UserOp / `execute()` signed by the owner). Deferred to a later slice. Agents **receive + hold**; withdrawal comes later.
- **Agent-as-payer / agent-to-agent payments** (an agent paying another agent from its own LightAccount) — needs the wallet to sign EIP-3009, i.e. the same UserOp machinery. Deferred. This slice is human-caller → agent.
- **Per-skill pricing**, subscriptions, dynamic/compute-based pricing — later.
- **Mainnet / real value** — audit-gated (Slice 6).

## Payment flow (the core)

On `POST /api/agents/[handle]/run`:

1. Look up the agent's price. If **price = 0** → run free via the existing path (unchanged). 
2. If **price > 0** and the request has **no / invalid `X-PAYMENT`** header → respond **HTTP 402** with payment requirements built **dynamically for this agent**: `scheme: "exact"`, `network: "eip155:84532"`, `payTo: <agent.wallet>`, the price, and `asset: <Base Sepolia USDC>`. (Built via `@x402/core` server + `registerExactEvmScheme` + `HTTPFacilitatorClient({ url: "https://x402.org/facilitator" })`.)
3. If the request carries a valid `X-PAYMENT`:
   a. **Verify** the payment with the facilitator. If invalid → 402 again.
   b. **Run** the skill (`invokeSkillRun`, `source="manual"`).
   c. On run **success**, **settle** the payment with the facilitator → USDC transfers to the agent wallet, returning a tx hash. Record the earning (amount, payer, tx) on the run. Return the result + `X-PAYMENT-RESPONSE` header.
   d. If the run **errors**, do **not** settle. The signed authorization is simply never used, so no funds move and no refund is needed. Return the error.

Caller never pays gas (facilitator does). The agent wallet (counterfactual LightAccount) receives USDC fine without being deployed.

## Data model (migration `004_earn.sql`)

New table `pricing`:

| column | type | notes |
|---|---|---|
| `agent_handle` | TEXT PRIMARY KEY | one price per agent |
| `price_atomic` | BIGINT NOT NULL | USDC atomic units (6 decimals); 0 = free |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Extend `runs` (same migration): add `payment_amount BIGINT` (atomic USDC, null = unpaid/free), `payer TEXT` (caller address, null if free), `payment_tx TEXT` (settlement tx hash, null if free).

## Components

### 1. `@agenomy/invoker` — pricing + earnings DB helpers (shared data layer)
- `getPrice(pool, handle) -> bigint` (0 if none).
- `setPrice(pool, handle, priceAtomic) -> void` (upsert).
- `recordPayment(pool, runId, { amount, payer, tx }) -> void` (sets the run's payment columns after settle).
- `earningsSummary(pool, handle) -> { totalAtomic, recent: [...] }` (sum + last N paid runs).

### 2. Owner auth helper (`apps/web/lib/owner-auth.ts`)
- `verifyOwnerSig({ handle, message, signature, expectedOwner }) -> boolean` using viem `verifyMessage` / `recoverMessageAddress`. The message includes the handle, the price, and a recent timestamp/nonce to prevent trivial replay (timestamp window check).

### 3. x402 server helper (`apps/web/lib/x402.ts`)
- Wraps `@x402/core` server: builds the 402 requirements for `(payTo, priceAtomic)`, exposes `verifyPayment(header, requirements)` and `settlePayment(header, requirements)` against the testnet facilitator. The exact `@x402/core` method names + types are pinned during planning by fetching the current API (kept honest: not hard-coded from memory).

### 4. API routes (`apps/web`)
- `GET /api/agents/[handle]/pricing` → current price (atomic + formatted).
- `POST /api/agents/[handle]/pricing` → `{ priceAtomic, message, signature }`; owner-gated; upsert.
- `GET /api/agents/[handle]/earnings` → `{ walletBalanceAtomic, totalEarnedAtomic, recent: [{ skillSlug, amount, payer, tx, at }] }`. Wallet balance read on-chain (USDC `balanceOf(agent.wallet)` via viem, reusing the onchain read pattern).
- `POST /api/agents/[handle]/run` → add the x402 gating above; free path unchanged.

### 5. UI (`apps/web`, agent profile)
- **Earnings card** (replaces the "coming in a later slice" placeholder): live wallet USDC balance, total earned, recent paid runs (amount + basescan tx link).
- **Set price control** (visible only when the connected wallet == agent owner): input price → sign message → POST pricing.
- **Pay & Run** in `InvokePanel`: when the selected agent has price > 0, the Run button uses an x402-paid fetch (`@x402/fetch` wrapped with the wagmi-connected wallet as the EIP-3009 signer) to call `/run`, auto-handling the 402 (wallet prompts to sign), with clear states (connect wallet → sign → paying → running). Price = 0 → normal free run, no wallet needed.

## Consistency / no-LARP guarantees

- Real x402, real EIP-3009, real on-chain USDC settlement on Base Sepolia. The agent wallet's balance shown is the live on-chain value, not a number we made up.
- Payment is verified **before** the skill runs and settled **only after** it succeeds — the caller is never charged for failed work.
- Free agents (price 0) behave exactly as today; we don't fake a paywall.
- We store **no private keys**; every signature happens in the caller's or owner's own wallet.

## Testing

- invoker: `getPrice`/`setPrice` round-trip, `recordPayment` sets the right columns, `earningsSummary` sums correctly (fake pool).
- owner-auth: a signature from the owner verifies; a signature from a non-owner is rejected; stale timestamp rejected.
- x402 helper: given a price + payTo, builds requirements with the right payTo/network/asset; verify/settle call the facilitator client (mocked) and surface success/failure.
- run route: price=0 runs free (no 402); price>0 without payment returns 402 with the agent's payTo; with a (mocked) valid payment, runs then records the earning; run error path does not settle.
- All on the existing vitest setup; facilitator + chain calls mocked in unit tests.

## Deploy

- Apply `004_earn.sql` to the VPS Postgres.
- Add `@x402/core`, `@x402/evm`, `@x402/fetch` deps (web). No new env keys (facilitator is public; USDC + chain addresses already in `@agenomy/shared`). Optionally `X402_FACILITATOR_URL` env (default `https://x402.org/facilitator`) for swappability.
- Build web, restart `agenomy-web`. **No new pm2 process, no new private keys.**
- Verify live: set a price on a test agent (owner signs), pay-and-run from a second wallet with faucet USDC, confirm USDC lands in the agent wallet + the earning shows on the profile, then reset the price to 0.

## To pin during planning (verify, don't assume)

- Exact `@x402/core` server API for building requirements + `verify`/`settle` (fetch current docs/types at plan time).
- Exact `@x402/fetch` client wiring with a wagmi `WalletClient` as the EIP-3009 signer in the browser.
- Confirm Base Sepolia USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) exposes EIP-3009 `transferWithAuthorization` (Circle USDC does; verify on-chain).
