# Solana Payment Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a caller pay for an agent run on Solana devnet (USDC-SPL), gated behind an on-chain-verified transfer, parallel to the existing Base x402 path.

**Architecture:** Approach A (signature-in-header). The run route already gates on `getPrice(handle) > 0` and verifies an `X-PAYMENT` (Base/x402) header. We add a parallel `X-PAYMENT-SOLANA: <tx-signature>` branch: a new server-only module `apps/web/lib/solana-pay.ts` verifies that the signed transaction transferred ≥ the price in devnet USDC-SPL to the agent's associated token account, was not already consumed (anti-replay via a new `solana_payments` table), and the run then executes and records the earning with `payment_chain = 'solana'`. One USDC price applies to both chains.

**Tech Stack:** TypeScript, Next.js (apps/web), Postgres, `@solana/web3.js`, `@solana/spl-token`, vitest. Devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

**Reference:** Design spec `docs/superpowers/specs/2026-06-21-solana-payment-settlement-design.md`. Existing patterns to mirror: `apps/web/lib/x402.ts` (requirements/verify), `packages/invoker/src/pricing.ts` (`recordPayment`, `earningsSummary`), `packages/invoker/test/pricing.test.ts` + `packages/invoker/test/fakePool.ts` (test mocking), `apps/web/lib/solana.ts` (existing Solana address derivation, server-only `node:crypto`).

---

## File Structure

- **Create** `apps/web/lib/solana-pay.ts` — Solana payment requirements + on-chain verification (server-only). Owns: the devnet USDC mint constant, `buildSolanaRequirements`, `verifySolanaPayment`.
- **Create** `apps/web/lib/solana-pay.test.ts` — unit tests for the above (mock `Connection` + pool).
- **Create** `migrations/007_solana_settlement.sql` — `solana_payments` table + `runs.payment_chain` column.
- **Modify** `packages/invoker/src/pricing.ts` — add `recordSolanaPayment`; add `payment_chain` to `EarningRow` + the `earningsSummary` recent query.
- **Modify** `packages/invoker/test/pricing.test.ts` — tests for `recordSolanaPayment` + chain in earnings.
- **Modify** `apps/web/app/api/agents/[handle]/run/route.ts` — add the Solana branch to the gate.
- **Modify** `apps/web/app/agents/[handle]/EarningsPanel.tsx` — show the chain per earning.
- **Modify** `apps/web/.env.local.example` + `apps/indexer`/`scheduler` not needed — only web reads Solana settlement env.
- **Create** `scripts/demo-solana-settlement.md` — the end-to-end devnet runbook (the no-LARP proof).
- **Modify** `apps/web/app/docs/payments/page.tsx` — disclose Solana settlement honestly (after the demo passes).

---

### Task 1: Dependencies + env

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: Add the Solana libraries to apps/web**

Run (from repo root):
```bash
pnpm --filter @agenomy/web add @solana/web3.js@^1.95.0 @solana/spl-token@^0.4.9
```
Expected: both appear under `dependencies` in `apps/web/package.json`; lockfile updates.

- [ ] **Step 2: Document the new env vars**

Append to `apps/web/.env.local.example`:
```
# Solana settlement (devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

- [ ] **Step 3: Verify install**

Run:
```bash
cd apps/web && node -e "require('@solana/web3.js'); require('@solana/spl-token'); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 4: Commit**
```bash
git add apps/web/package.json apps/web/.env.local.example pnpm-lock.yaml
git commit -m "build(web): add @solana/web3.js + spl-token for Solana settlement"
```

---

### Task 2: Schema — solana_payments table + runs.payment_chain

**Files:**
- Create: `migrations/007_solana_settlement.sql`

- [ ] **Step 1: Write the migration**

Create `migrations/007_solana_settlement.sql`:
```sql
-- 007_solana_settlement: anti-replay store for consumed Solana payment signatures,
-- each tied to the run it paid for (signature PK => a signature can never settle twice).
-- Plus a chain dimension on the run's earning so Base + Solana earnings read consistently.
CREATE TABLE IF NOT EXISTS solana_payments (
  signature   TEXT PRIMARY KEY,
  run_id      BIGINT NOT NULL,
  amount      NUMERIC(78,0) NOT NULL,  -- USDC atomic units (6 decimals)
  payer       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE runs ADD COLUMN IF NOT EXISTS payment_chain TEXT;  -- 'base' | 'solana'; null = free/unpaid
```

- [ ] **Step 2: Apply to the local dev database**

Run (Postgres reachable per `DATABASE_URL`; adjust container name if needed):
```bash
docker exec -i agenomy-postgres psql -U aeon -d agenomy < migrations/007_solana_settlement.sql
```
Expected: `CREATE TABLE` then `ALTER TABLE`.

- [ ] **Step 3: Verify schema**

Run:
```bash
docker exec agenomy-postgres psql -U aeon -d agenomy -c "\d solana_payments" -c "SELECT column_name FROM information_schema.columns WHERE table_name='runs' AND column_name='payment_chain';"
```
Expected: the `solana_payments` columns listed, and `payment_chain` returned.

- [ ] **Step 4: Commit**
```bash
git add migrations/007_solana_settlement.sql
git commit -m "feat(db): solana_payments table + runs.payment_chain (migration 007)"
```

---

### Task 3: invoker — recordSolanaPayment + earnings chain

**Files:**
- Modify: `packages/invoker/src/pricing.ts`
- Test: `packages/invoker/test/pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/invoker/test/pricing.test.ts` (import `recordSolanaPayment` in the existing import line from `../src/pricing`):
```ts
  it("recordSolanaPayment consumes the signature and tags the run as solana", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await recordSolanaPayment(pool, "7", { amount: 10000n, payer: "SoLpAyer", signature: "sigABC" });
    // first call: insert into solana_payments (anti-replay)
    expect(pool.calls[0].text).toMatch(/INSERT INTO solana_payments/i);
    expect(pool.calls[0].values).toEqual(["sigABC", "7", "10000", "SoLpAyer"]);
    // second call: update the run's earning columns with chain=solana, tx=signature
    expect(pool.calls[1].text).toMatch(/UPDATE runs SET payment_amount/i);
    expect(pool.calls[1].values).toEqual(["7", "10000", "SoLpAyer", "sigABC", "solana"]);
  });

  it("earningsSummary returns payment_chain on recent rows", async () => {
    const pool = fakePool((t) => {
      if (t.includes("SUM")) return { rowCount: 1, rows: [{ total: "10000" }] };
      if (t.includes("ORDER BY")) return { rowCount: 1, rows: [{ skill_slug: "x", payment_amount: "10000", payer: "p", payment_tx: "sig", payment_chain: "solana", started_at: "t" }] };
      return undefined;
    });
    const s = await earningsSummary(pool, "gas");
    expect(s.recent[0].payment_chain).toBe("solana");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @agenomy/invoker test -- pricing
```
Expected: FAIL — `recordSolanaPayment is not a function` and `payment_chain` undefined.

- [ ] **Step 3: Implement**

In `packages/invoker/src/pricing.ts`, add `payment_chain` to `EarningRow`:
```ts
export interface EarningRow {
  skill_slug: string;
  payment_amount: string;
  payer: string;
  payment_tx: string;
  payment_chain: string | null;
  started_at: string;
}
```

Add the new helper after `recordPayment`:
```ts
export interface SolanaPaymentInfo {
  amount: bigint;
  payer: string;
  signature: string;
}

/** Record a verified Solana settlement: consume the signature (anti-replay) and tag the run. */
export async function recordSolanaPayment(
  pool: Queryable,
  runId: string,
  p: SolanaPaymentInfo,
): Promise<void> {
  await pool.query(
    `INSERT INTO solana_payments (signature, run_id, amount, payer) VALUES ($1, $2, $3, $4)`,
    [p.signature, runId, p.amount.toString(), p.payer],
  );
  await pool.query(
    `UPDATE runs SET payment_amount = $2, payer = $3, payment_tx = $4, payment_chain = $5 WHERE id = $1`,
    [runId, p.amount.toString(), p.payer, p.signature, "solana"],
  );
}
```

Update the `earningsSummary` recent query to select `payment_chain` (find the `ORDER BY` query in that function and add the column):
```ts
  const recent = await pool.query(
    `SELECT skill_slug, payment_amount, payer, payment_tx, payment_chain, started_at
       FROM runs
      WHERE agent_handle = $1 AND payment_amount IS NOT NULL
      ORDER BY started_at DESC
      LIMIT $2`,
    [handle, limit],
  );
```
(Keep the rest of `earningsSummary` unchanged; if the existing query already lists explicit columns, just insert `payment_chain` into the list.)

Export `recordSolanaPayment` from the invoker index if `packages/invoker/src/index.ts` re-exports pricing members explicitly (mirror how `recordPayment` is exported).

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @agenomy/invoker test -- pricing
```
Expected: PASS (all pricing tests, including the two new ones).

- [ ] **Step 5: Commit**
```bash
git add packages/invoker/src/pricing.ts packages/invoker/test/pricing.test.ts packages/invoker/src/index.ts
git commit -m "feat(invoker): recordSolanaPayment + payment_chain on earnings"
```

---

### Task 4: solana-pay.ts — constants + buildSolanaRequirements

**Files:**
- Create: `apps/web/lib/solana-pay.ts`
- Test: `apps/web/lib/solana-pay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/solana-pay.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSolanaRequirements, USDC_MINT_DEVNET } from "./solana-pay";

describe("buildSolanaRequirements", () => {
  it("returns devnet USDC requirements with the agent's ATA", () => {
    // wizard's real derived devnet address
    const agent = "7vAdck8sYyAgkFCUCSLqUXvvS8SE5aeveYEeJG7bzGmu";
    const req = buildSolanaRequirements(agent, 10000n);
    expect(req.network).toBe("devnet");
    expect(req.payTo).toBe(agent);
    expect(req.mint).toBe(USDC_MINT_DEVNET);
    expect(req.amount).toBe("10000");
    expect(req.decimals).toBe(6);
    // ATA is a deterministic base58 pubkey distinct from the owner
    expect(req.ata).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(req.ata).not.toBe(agent);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @agenomy/web test -- solana-pay
```
Expected: FAIL — module not found / `buildSolanaRequirements` undefined.

- [ ] **Step 3: Implement the constants + builder**

First ensure the `Queryable` type is exported from the invoker package: open `packages/invoker/src/index.ts` and confirm it re-exports `Queryable` from `./db` (it already re-exports the pricing helpers). If `Queryable` is not exported, add `export type { Queryable } from "./db";` there. Then create `apps/web/lib/solana-pay.ts`:
```ts
// Server-only Solana settlement helpers (devnet). Never import from a client component.
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Queryable } from "@agenomy/invoker";

/** Circle's devnet USDC SPL mint. */
export const USDC_MINT_DEVNET =
  process.env.SOLANA_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export interface SolanaRequirements {
  network: "devnet";
  payTo: string;   // agent Solana address (owner)
  ata: string;     // agent's USDC associated token account (where USDC lands)
  mint: string;
  amount: string;  // USDC atomic units (6 decimals), as a string
  decimals: 6;
}

/** Build the requirements a caller needs to pay this agent in devnet USDC-SPL. Pure. */
export function buildSolanaRequirements(
  agentSolanaAddress: string,
  amountAtomic: bigint,
): SolanaRequirements {
  const owner = new PublicKey(agentSolanaAddress);
  const mint = new PublicKey(USDC_MINT_DEVNET);
  const ata = getAssociatedTokenAddressSync(mint, owner);
  return {
    network: "devnet",
    payTo: agentSolanaAddress,
    ata: ata.toBase58(),
    mint: USDC_MINT_DEVNET,
    amount: amountAtomic.toString(),
    decimals: 6,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm --filter @agenomy/web test -- solana-pay
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/solana-pay.ts apps/web/lib/solana-pay.test.ts
git commit -m "feat(web): buildSolanaRequirements (devnet USDC-SPL)"
```

---

### Task 5: solana-pay.ts — verifySolanaPayment

**Files:**
- Modify: `apps/web/lib/solana-pay.ts`
- Test: `apps/web/lib/solana-pay.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/lib/solana-pay.test.ts`:
```ts
import { verifySolanaPayment } from "./solana-pay";

// minimal fake pool: replay lookup returns rows per the handler
function poolReturning(rows: Record<string, unknown>[]) {
  return { query: async () => ({ rowCount: rows.length, rows }) } as never;
}

// a fake Connection whose getTransaction returns a pre-built tx meta
function fakeConn(tx: unknown) {
  return { getTransaction: async () => tx } as never;
}

const AGENT = "7vAdck8sYyAgkFCUCSLqUXvvS8SE5aeveYEeJG7bzGmu";
const MINT = USDC_MINT_DEVNET;
// tx that credits AGENT's USDC balance by 10000 and debits PAYER by 10000
const goodTx = {
  meta: {
    err: null,
    preTokenBalances: [
      { accountIndex: 1, mint: MINT, owner: AGENT, uiTokenAmount: { amount: "0" } },
      { accountIndex: 2, mint: MINT, owner: "PAYER", uiTokenAmount: { amount: "50000" } },
    ],
    postTokenBalances: [
      { accountIndex: 1, mint: MINT, owner: AGENT, uiTokenAmount: { amount: "10000" } },
      { accountIndex: 2, mint: MINT, owner: "PAYER", uiTokenAmount: { amount: "40000" } },
    ],
  },
};

describe("verifySolanaPayment", () => {
  const req = buildSolanaRequirements(AGENT, 10000n);

  it("accepts a valid, unconsumed transfer that credits the agent", async () => {
    const v = await verifySolanaPayment("sig1", req, poolReturning([]), fakeConn(goodTx));
    expect(v.valid).toBe(true);
    expect(v.payer).toBe("PAYER");
    expect(v.amount).toBe(10000n);
  });

  it("rejects a not-found tx", async () => {
    const v = await verifySolanaPayment("sig1", req, poolReturning([]), fakeConn(null));
    expect(v).toMatchObject({ valid: false, reason: "not_found" });
  });

  it("rejects a failed tx", async () => {
    const failed = { meta: { ...goodTx.meta, err: { some: "error" } } };
    const v = await verifySolanaPayment("sig1", req, poolReturning([]), fakeConn(failed));
    expect(v).toMatchObject({ valid: false, reason: "tx_failed" });
  });

  it("rejects an underpayment", async () => {
    const v = await verifySolanaPayment("sig1", buildSolanaRequirements(AGENT, 20000n), poolReturning([]), fakeConn(goodTx));
    expect(v).toMatchObject({ valid: false, reason: "mismatch" });
  });

  it("rejects the wrong mint", async () => {
    const wrongMint = JSON.parse(JSON.stringify(goodTx));
    wrongMint.meta.preTokenBalances[0].mint = "OtherMint111111111111111111111111111111111";
    wrongMint.meta.postTokenBalances[0].mint = "OtherMint111111111111111111111111111111111";
    const v = await verifySolanaPayment("sig1", req, poolReturning([]), fakeConn(wrongMint));
    expect(v).toMatchObject({ valid: false, reason: "mismatch" });
  });

  it("rejects a consumed signature (replay)", async () => {
    const v = await verifySolanaPayment("sig1", req, poolReturning([{ signature: "sig1" }]), fakeConn(goodTx));
    expect(v).toMatchObject({ valid: false, reason: "replay" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @agenomy/web test -- solana-pay
```
Expected: FAIL — `verifySolanaPayment` undefined.

- [ ] **Step 3: Implement verifySolanaPayment**

Append to `apps/web/lib/solana-pay.ts`:
```ts
export interface VerifyResult {
  valid: boolean;
  payer?: string;
  amount?: bigint;
  reason?: "not_found" | "tx_failed" | "mismatch" | "replay" | "error";
}

interface TokenBalance {
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string };
}

function balanceOf(arr: TokenBalance[] | undefined, owner: string, mint: string): bigint {
  const e = (arr ?? []).find((b) => b.owner === owner && b.mint === mint);
  return e ? BigInt(e.uiTokenAmount.amount) : 0n;
}

/**
 * Verify that `signature` is a confirmed devnet tx that transferred >= the required amount of
 * USDC-SPL to the agent's address, and that the signature has not been consumed before.
 * Never throws. `conn` is injectable for tests; defaults to the devnet RPC.
 */
export async function verifySolanaPayment(
  signature: string,
  req: SolanaRequirements,
  pool: Queryable,
  conn: Connection = new Connection(RPC_URL, "confirmed"),
): Promise<VerifyResult> {
  try {
    if (!signature) return { valid: false, reason: "not_found" };

    // anti-replay first (cheap, avoids an RPC call on a reused signature)
    const consumed = await pool.query(`SELECT 1 FROM solana_payments WHERE signature = $1`, [signature]);
    if ((consumed.rowCount ?? 0) > 0) return { valid: false, reason: "replay" };

    const tx = await conn.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || !tx.meta) return { valid: false, reason: "not_found" };
    if (tx.meta.err !== null) return { valid: false, reason: "tx_failed" };

    const pre = tx.meta.preTokenBalances as TokenBalance[] | undefined;
    const post = tx.meta.postTokenBalances as TokenBalance[] | undefined;
    const credited = balanceOf(post, req.payTo, req.mint) - balanceOf(pre, req.payTo, req.mint);
    const need = BigInt(req.amount);
    if (credited < need) return { valid: false, reason: "mismatch" };

    // payer = the owner (other than the agent) whose USDC balance decreased
    const payers = (post ?? [])
      .filter((b) => b.mint === req.mint && b.owner && b.owner !== req.payTo)
      .map((b) => ({ owner: b.owner as string, delta: balanceOf(post, b.owner as string, req.mint) - balanceOf(pre, b.owner as string, req.mint) }))
      .filter((x) => x.delta < 0n)
      .sort((a, b) => (a.delta < b.delta ? -1 : 1));
    const payer = payers[0]?.owner;

    return { valid: true, payer, amount: credited };
  } catch {
    return { valid: false, reason: "error" };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @agenomy/web test -- solana-pay
```
Expected: PASS (all `buildSolanaRequirements` + `verifySolanaPayment` cases).

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/solana-pay.ts apps/web/lib/solana-pay.test.ts
git commit -m "feat(web): verifySolanaPayment (on-chain devnet USDC-SPL verification + anti-replay)"
```

---

### Task 6: Wire the Solana branch into the run route

**Files:**
- Modify: `apps/web/app/api/agents/[handle]/run/route.ts`

- [ ] **Step 1: Add the imports**

At the top of `route.ts`, add:
```ts
import { getPrice, recordPayment, recordSolanaPayment, invokeSkillRun, type InvokeEnv } from "@agenomy/invoker";
import { buildSolanaRequirements, verifySolanaPayment } from "../../../../../lib/solana-pay";
import { deriveSolanaAddress } from "../../../../../lib/solana";
```
(Keep the existing x402 import. Replace the existing invoker import line so it also imports `recordSolanaPayment`.)

- [ ] **Step 2: Replace the pricing gate block**

Replace the whole `if (price > 0n) { ... }` block (and the later settle block) so the route handles both rails. The new gate, inserted where the old `if (price > 0n)` was:
```ts
  const xPayment = request.headers.get("X-PAYMENT") ?? "";
  const xPaymentSolana = request.headers.get("X-PAYMENT-SOLANA") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseRequirements: any[] | null = null;
  let basePayer = "";
  let solanaPaid: { payer: string; amount: bigint; signature: string } | null = null;

  if (price > 0n) {
    const ares = await pool.query(`SELECT wallet, solana_wallet FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
    if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
    const payToBase = String(ares.rows[0].wallet) as `0x${string}`;
    const agentSolana = ares.rows[0].solana_wallet
      ? String(ares.rows[0].solana_wallet)
      : deriveSolanaAddress(payToBase);
    const solReq = buildSolanaRequirements(agentSolana, price);

    if (xPaymentSolana) {
      // Solana rail
      const v = await verifySolanaPayment(xPaymentSolana, solReq, pool);
      if (!v.valid) {
        let baseReq: unknown = null;
        try { baseReq = paymentRequiredBody(await buildRequirements(payToBase, price)); } catch { /* base offline */ }
        return NextResponse.json({ error: "payment required", solana: solReq, base: baseReq }, { status: 402 });
      }
      solanaPaid = { payer: v.payer ?? "", amount: v.amount ?? price, signature: xPaymentSolana };
    } else {
      // Base x402 rail (default)
      try {
        baseRequirements = await buildRequirements(payToBase, price);
      } catch (e) {
        return NextResponse.json({ error: "payment service unavailable", detail: String(e) }, { status: 503 });
      }
      const v = await verifyPayment(xPayment, baseRequirements);
      if (!v.valid) {
        return NextResponse.json({ ...(paymentRequiredBody(baseRequirements) as object), solana: solReq }, { status: 402 });
      }
      basePayer = v.payer ?? "";
    }
  }
```

- [ ] **Step 3: Run the skill (unchanged), then settle/record per rail**

Replace the old settle block after `invokeSkillRun` with:
```ts
  let paymentTx: string | undefined;
  let paidChain: string | undefined;

  if (solanaPaid && r.status === "ok" && r.runId) {
    try {
      await recordSolanaPayment(pool, r.runId, { amount: solanaPaid.amount, payer: solanaPaid.payer, signature: solanaPaid.signature });
      paymentTx = solanaPaid.signature;
      paidChain = "solana";
    } catch (e) {
      // duplicate signature (race) or DB error: do not fabricate the earning
      return NextResponse.json({ runId: r.runId, status: r.status, output: r.output, trace: r.trace, settleError: String(e) });
    }
  } else if (baseRequirements && r.status === "ok" && r.runId) {
    try {
      const s = await settlePayment(xPayment, baseRequirements);
      paymentTx = s.txHash;
      paidChain = "base";
      await recordPayment(pool, r.runId, { amount: price, payer: basePayer || s.payer || "", tx: s.txHash });
    } catch (e) {
      return NextResponse.json({ runId: r.runId, status: r.status, output: r.output, trace: r.trace, settleError: String(e) });
    }
  }

  return NextResponse.json({
    runId: r.runId,
    status: r.status,
    output: r.output,
    trace: r.trace,
    error: r.error,
    paymentTx,
    chain: paidChain,
  });
```
(Remove the old `requirements`/`payer` variables that this replaces; the run-invoke + `invokeError` handling between the gate and settle stays exactly as it was.)

- [ ] **Step 4: Typecheck + build**

Run:
```bash
pnpm --filter @agenomy/web typecheck && pnpm --filter @agenomy/web build
```
Expected: typecheck clean; build succeeds (Compiled successfully).

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/api/agents/[handle]/run/route.ts"
git commit -m "feat(web): run route accepts Solana settlement (X-PAYMENT-SOLANA) alongside x402"
```

---

### Task 7: EarningsPanel — show the chain

**Files:**
- Modify: `apps/web/app/agents/[handle]/EarningsPanel.tsx`

- [ ] **Step 1: Read the current rendering**

Run:
```bash
sed -n '1,140p' "apps/web/app/agents/[handle]/EarningsPanel.tsx"
```
Identify where each recent earning row renders `payment_tx` / amount (the `recent.map(...)` block) and the `EarningRow` type usage.

- [ ] **Step 2: Render a chain badge per earning**

In the `recent.map((e) => ...)` row, add a small badge next to the amount using `e.payment_chain`:
```tsx
<span className="earn-chain">{e.payment_chain === "solana" ? "Solana" : "Base"}</span>
```
The earning rows come from `earningsSummary` (already returns `payment_chain` after Task 3). If the panel fetches via `/api/agents/[handle]/earnings`, confirm that route returns `payment_chain` (it passes `earningsSummary` through — already covered).

- [ ] **Step 3: Verify in the browser (manual)**

Run the app (`pnpm --filter @agenomy/web dev`), open an agent with a paid run, confirm each earning shows a Base/Solana badge. (Full visual confirmation; no automated assertion needed for this label-only change.)

- [ ] **Step 4: Commit**
```bash
git add "apps/web/app/agents/[handle]/EarningsPanel.tsx"
git commit -m "feat(web): show settlement chain (Base/Solana) per earning"
```

---

### Task 8: End-to-end devnet demonstration (the no-LARP proof)

**Files:**
- Create: `scripts/demo-solana-settlement.md`

This is the success criterion: a real, on-chain Solana settlement that gates a run. Write it as a runbook so it can be re-run.

- [ ] **Step 1: Write the runbook**

Create `scripts/demo-solana-settlement.md`:
````markdown
# Demo: Solana settlement end-to-end (devnet)

Prereqs: `spl-token` CLI (`cargo install spl-token-cli` or via `solana-install`), a funded devnet payer keypair.

1. Create + fund a payer:
   ```bash
   solana-keygen new -o /tmp/payer.json --no-bip39-passphrase
   solana airdrop 1 -k /tmp/payer.json -u devnet            # SOL for fees
   ```
2. Get devnet USDC for the payer from Circle's faucet (https://faucet.circle.com, pick Solana Devnet, paste the payer pubkey: `solana-keygen pubkey /tmp/payer.json`).
3. Set a price on the test agent (e.g. `wizard`) of 0.01 USDC:
   ```bash
   curl -X POST https://agenomylayer.com/api/agents/wizard/pricing \
     -H 'content-type: application/json' -d '{"priceAtomic":"10000"}'   # adjust to the real pricing endpoint/auth
   ```
4. Find the agent's USDC ATA (printed in the 402 response):
   ```bash
   curl -s -X POST https://agenomylayer.com/api/agents/wizard/run \
     -H 'content-type: application/json' -d '{"skillSlug":"base-gas-check","input":"go"}' | jq .solana
   ```
5. Transfer 0.01 USDC to that ATA from the payer (the recipient ATA is created if missing):
   ```bash
   spl-token transfer --url devnet --fund-recipient --owner /tmp/payer.json \
     4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 0.01 <AGENT_USDC_ATA>
   ```
   Note the transaction signature.
6. Retry the run with the signature:
   ```bash
   curl -s -X POST https://agenomylayer.com/api/agents/wizard/run \
     -H 'content-type: application/json' -H 'X-PAYMENT-SOLANA: <SIGNATURE>' \
     -d '{"skillSlug":"base-gas-check","input":"go"}' | jq '{runId,status,paymentTx,chain}'
   ```
   Expected: `status: "ok"`, `chain: "solana"`, `paymentTx` = the signature.
7. Verify on Solana explorer: `https://explorer.solana.com/tx/<SIGNATURE>?cluster=devnet`.
8. Replay test — re-POST step 6 with the same signature. Expected: `402` (reason replay; the run does not execute again).
````

- [ ] **Step 2: Execute the runbook on devnet**

Follow the steps. Capture: the run JSON (`chain: "solana"`), the explorer link, and the replay 402.

- [ ] **Step 3: Commit**
```bash
git add scripts/demo-solana-settlement.md
git commit -m "docs: end-to-end devnet runbook for Solana settlement"
```

---

### Task 9: Honest docs disclosure (only after Task 8 passes)

**Files:**
- Modify: `apps/web/app/docs/payments/page.tsx`
- Modify: `apps/web/app/docs/faq/page.tsx`

- [ ] **Step 1: Update payments doc**

In `apps/web/app/docs/payments/page.tsx`, add a section after the x402/Base explanation:
```tsx
<h2>Paying on Solana</h2>
<p>
  An agent&apos;s USDC price can also be paid on <strong>Solana devnet</strong>. The caller
  sends USDC-SPL to the agent&apos;s associated token account and retries the run with an{" "}
  <code>X-PAYMENT-SOLANA: &lt;signature&gt;</code> header; the run executes once the transfer is
  verified on-chain. Unlike the Base x402 path (authorize-then-settle), Solana payment is{" "}
  <strong>upfront</strong>: if a run fails after payment, it is not auto-refunded yet — refunds
  are a roadmap item. Settlement on Solana is devnet only.
</p>
```

- [ ] **Step 2: Update the FAQ roadmap bullet**

In `apps/web/app/docs/faq/page.tsx`, change the "Solana settlement" not-built-yet bullet to reflect it is now live on devnet (move it out of the "NOT built" list into the live description), e.g.:
```tsx
<li><strong>Solana settlement</strong> — live on devnet: pay an agent&apos;s USDC price on Solana (USDC-SPL) as well as Base. Refunds on failed Solana runs are still a roadmap item.</li>
```
Also update the homepage primitive 05 tag in `apps/web/app/page.tsx` from `Base (Solana settlement on the roadmap)` to `Base + Solana (devnet)` — **only after the demo passes**.

- [ ] **Step 3: Build + deploy**

Run the standard deploy (local build, then scp + VPS rebuild + restart per the deploy recipe in `resume-next-up` memory). Set `SOLANA_RPC_URL` + `SOLANA_USDC_MINT` in the VPS `apps/web/.env.local`, and apply migration 007 to the VPS Postgres before restart.

- [ ] **Step 4: Commit + push**
```bash
git add apps/web/app/docs/payments/page.tsx apps/web/app/docs/faq/page.tsx apps/web/app/page.tsx
git commit -m "docs(web): Solana settlement live on devnet (paid upfront, refunds roadmap)"
git push origin slice-1-agent-identity:main
```

---

## Notes for the implementer

- **Replay safety under races:** `solana_payments.signature` is the PK, so two concurrent runs presenting the same signature: one INSERT wins, the other throws → `recordSolanaPayment` rejects and the route returns `settleError` without recording a second earning. The pre-run `verifySolanaPayment` replay check is the fast path; the PK is the hard guarantee.
- **No spend of the agent's Solana key:** the agent's derived Solana key is never needed here — we only verify inbound transfers. Refunds (which would need it) are out of scope.
- **Env on VPS:** add `SOLANA_RPC_URL` + `SOLANA_USDC_MINT` to `/opt/agenomy/apps/web/.env.local` and apply migration 007 before the restart in Task 9.
