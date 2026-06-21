# Solana Payment Settlement — Design

**Date:** 2026-06-21
**Status:** Approved (brainstorming) — ready for implementation plan
**Owner chain decisions:** Approach A (signature-in-header), asset = devnet USDC-SPL, one shared USDC price, MVP without refund.

## Goal

Let a caller pay for an agent run on **Solana devnet** (USDC-SPL), in addition to the
existing Base path (USDC over x402). One agent, one USDC price, payable on **either chain**.
The run is gated behind a payment that is **verified on-chain** before execution. Everything
is devnet/testnet and must be genuinely demonstrable end-to-end (no-LARP).

## Context (what exists today)

- **Base payments** work via x402 in `apps/web/app/api/agents/[handle]/run/route.ts`:
  if `getPrice(pool, handle) > 0`, the route builds x402 requirements (`lib/x402.ts`,
  `buildRequirements(payTo=agent Base wallet, price)`), verifies the `X-PAYMENT` header via a
  facilitator, runs the skill, then **settles after success** and records the earning via
  `recordPayment(pool, runId, {amount, payer, tx})`. x402 = authorize-then-settle (the caller
  is never charged for failed work).
- **Solana is identity-only today.** Every agent has a real, derived Solana address
  (`apps/web/lib/solana.ts`, `deriveSolanaAddress`) shown on its profile. No Solana payments.
- x402 is EVM-only (EIP-3009 + facilitator); it **cannot** be reused for Solana. Solana needs
  its own verification rail.

## Non-goals (explicitly out of scope for this MVP)

- **Refund / escrow on failed runs.** Solana payment is upfront (see "Difference from x402").
  A run that errors after a Solana payment is **not** auto-refunded in the MVP. Documented as a
  known limitation; operator-refund / escrow is a future enhancement.
- **A separate Solana price.** One USDC price applies to both chains.
- **A polished pay-on-Solana wallet UI** (Phantom / Solana Pay QR). MVP success is the API gate
  + an end-to-end demonstration script. A minimal UI affordance is an optional stretch.
- **Mainnet.** Devnet only, no real value, consistent with the rest of the testnet product.
- **Spending the agent's Solana balance** (withdraw/forward). MVP only needs receive + verify.

## Architecture — Approach A: signature-in-header, parallel to x402

The caller signals which rail it is using by which header it sends on the retry:

- `X-PAYMENT` (existing) → Base x402 path. **Unchanged.**
- `X-PAYMENT-SOLANA: <tx-signature>` (new) → Solana path.
- If neither header carries a valid payment and `price > 0` → respond **402** with **both**
  requirement sets so the caller can choose a chain.

402 body shape (additive — the existing x402 body is preserved under `x402`):

```json
{
  "x402": { "...existing x402 requirements (Base)..." },
  "solana": {
    "network": "devnet",
    "payTo": "<agent Solana address>",
    "ata": "<agent USDC associated token account>",
    "mint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "amount": "<USDC base units, 6 decimals>",
    "decimals": 6
  }
}
```

### Pricing model

One USDC price (the existing `getPrice`/`setPrice`, base units, 6 decimals). The same amount
maps to Base USDC (x402) or devnet USDC-SPL (same 6 decimals). No schema change to pricing.

### Solana verification module — `apps/web/lib/solana-pay.ts` (new, server-only)

Uses `@solana/web3.js` + `@solana/spl-token` (added to `apps/web` deps; imported only in server
code so it never ships to the client bundle).

- `buildSolanaRequirements(agentSolanaAddress: string, amountBaseUnits: bigint)` →
  `{ network: "devnet", payTo, ata, mint, amount, decimals }` where
  `ata = getAssociatedTokenAddressSync(USDC_MINT, agentSolanaAddress)`.
- `verifySolanaPayment(signature: string, req: SolanaRequirements, pool)` →
  `{ valid: boolean, payer?: string, amount?: bigint, reason?: string }`. Steps:
  1. `connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 })`.
     Missing/unconfirmed → `{valid:false, reason:"not_found"}`.
  2. `meta.err === null` (tx succeeded) else `{valid:false, reason:"tx_failed"}`.
  3. The tx **credits the agent's USDC ATA** by `>= amount` of `USDC_MINT`. Determined from the
     token balance delta: find the `meta.postTokenBalances` / `preTokenBalances` entry for
     `accountIndex` whose `mint === USDC_MINT` and owner === agent Solana address; assert
     `(post - pre) >= amount`. Wrong mint / recipient / amount → `{valid:false, reason:"mismatch"}`.
  4. **Replay check:** `signature` not already in `solana_payments`. Present → `{valid:false, reason:"replay"}`.
  5. Derive `payer` as the source token account owner (first negative-delta owner). Return
     `{valid:true, payer, amount: post-pre}`.

`USDC_MINT` and the devnet RPC come from env (`SOLANA_USDC_MINT`, `SOLANA_RPC_URL`).

### Anti-replay + earnings — migration `migrations/007_solana_settlement.sql` (new)

```sql
-- 007_solana_settlement: record consumed Solana payment signatures (anti-replay)
-- and tie each to the run it paid for. signature is the primary key, so a reused
-- signature can never settle a second run.
CREATE TABLE IF NOT EXISTS solana_payments (
  signature   TEXT PRIMARY KEY,
  run_id      BIGINT NOT NULL,
  amount      NUMERIC(78,0) NOT NULL,
  payer       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Earnings: extend the payment recording so a run's earning carries its chain. Add a
`recordSolanaPayment(pool, runId, {amount, payer, signature})` helper in `packages/invoker`
(parallel to `recordPayment`) that inserts the `solana_payments` row **and** records the earning
with `chain = "solana"`. The existing Base `recordPayment` records `chain = "base"` (default).
EarningsPanel shows the chain per payment so Base + Solana earnings read consistently.

> Decision: the run's earning row needs a `chain` dimension. If `recordPayment` writes to a
> `runs` column or an `earnings` table, add a nullable `chain TEXT DEFAULT 'base'` there in the
> same migration. The implementation plan resolves the exact earnings storage from
> `packages/invoker`.

## Data flow

```
caller ──POST /run {skillSlug,input}──▶ run route
                   │ price>0 and no valid payment header?
     ◀──402────────┤ body = { x402: {...Base...}, solana: {payTo, ata, mint, amount} }
caller sends USDC-SPL to the agent ATA on devnet (own wallet / script)
caller ──POST /run + X-PAYMENT-SOLANA: <sig>──▶ run route
                   │ verifySolanaPayment(sig): tx ok? credits ATA ≥ amount? mint ok? not replayed?
                   │ valid → invokeSkillRun(...)
                   │ run ok → INSERT solana_payments(sig,...) + recordSolanaPayment(chain=solana)
     ◀──200 + result┤ { runId, status, output, trace, paymentTx: sig, chain: "solana" }
```

The Base x402 branch is unchanged and runs when `X-PAYMENT` is present instead.

## Components / files

- **New:** `apps/web/lib/solana-pay.ts` — `buildSolanaRequirements`, `verifySolanaPayment`, constants.
- **New:** `migrations/007_solana_settlement.sql` — `solana_payments` table (+ earnings `chain`).
- **New:** `packages/invoker` — `recordSolanaPayment` helper.
- **Modify:** `apps/web/app/api/agents/[handle]/run/route.ts` — add the Solana branch to the gate
  + the post-run record; 402 body returns both requirement sets.
- **Modify:** `apps/web/app/agents/[handle]/EarningsPanel.tsx` — show chain per payment.
- **New (test/demo):** `scripts/demo-solana-settlement.ts` (or a documented runbook) — fund a payer
  with devnet USDC, send to the agent ATA, retry the run with the header, assert the gated run ran
  and the earning recorded.
- **Deps:** add `@solana/web3.js` + `@solana/spl-token` to `apps/web`.
- **Env:** `SOLANA_RPC_URL=https://api.devnet.solana.com`,
  `SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

## Difference from x402 (important)

x402 authorizes then **settles after a successful run**, so the caller is never charged for
failed work. The Solana path is **paid upfront**: the USDC transfer is already on-chain before
the caller retries with the signature. Therefore:

- The gate **verifies** an already-completed transfer; there is no post-run "settle" step.
- If the run **fails after a valid Solana payment**, the MVP does **not** refund (documented
  limitation). The signature is still consumed only on a successful run; a failed run leaves the
  signature unconsumed, but the funds have already moved on-chain (no refund path in MVP).
- This asymmetry is disclosed in the docs (payments page / FAQ) so the product stays honest:
  "Solana settlement is paid upfront; refunds on failed runs are a roadmap item."

## Error handling

| Situation | Response |
|---|---|
| `price>0`, no/invalid payment header | `402` with `{x402, solana}` requirements |
| Solana sig not found / unconfirmed | `402` (treated as not paid) |
| tx failed (`meta.err`) | `402` |
| wrong mint / recipient / amount too low | `402` |
| signature already consumed (replay) | `402` |
| Solana RPC unreachable | `503` (payment service unavailable) |
| run errors after valid payment | `200` with run error surfaced; payment stands, no refund (MVP) |

## Testing & success criteria (no-LARP)

- **Unit (`apps/web/lib/solana-pay.test.ts`):** valid transfer; wrong amount (too low); wrong mint;
  wrong recipient ATA; failed tx (`meta.err`); replayed/consumed signature; tx-not-found.
  Mock the `Connection.getTransaction` shape.
- **Integration:** the run-route gate returns 402 with both requirement sets when unpaid; runs and
  records when a valid `X-PAYMENT-SOLANA` is presented (mock `verifySolanaPayment`).
- **End-to-end demonstration (the real proof):** on devnet, fund a payer wallet with USDC from the
  Circle devnet faucet, set a price on a test agent, send USDC-SPL to the agent's ATA, POST the run
  with `X-PAYMENT-SOLANA: <sig>`, confirm the gated run executes and the earning is recorded with
  `chain=solana`, and the signature is rejected on a replay attempt. Capture the explorer link.

## Future enhancements (not now)

- Operator-refund or escrow so callers aren't charged for failed Solana runs (parity with x402).
- Pay-on-Solana UI (Solana Pay QR / Phantom) in the InvokePanel.
- Solana mainnet settlement (after audit, alongside Base mainnet).
