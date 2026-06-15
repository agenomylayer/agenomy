import type { Queryable } from "./db";

export async function getPrice(pool: Queryable, handle: string): Promise<bigint> {
  const res = await pool.query(`SELECT price_atomic FROM pricing WHERE agent_handle = $1`, [handle]);
  if ((res.rowCount ?? 0) === 0) return 0n;
  return BigInt(String(res.rows[0].price_atomic));
}

export async function setPrice(pool: Queryable, handle: string, priceAtomic: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO pricing (agent_handle, price_atomic, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (agent_handle) DO UPDATE SET price_atomic = EXCLUDED.price_atomic, updated_at = now()`,
    [handle, priceAtomic.toString()],
  );
}

export interface PaymentInfo {
  amount: bigint;
  payer: string;
  tx: string;
}
export async function recordPayment(pool: Queryable, runId: string, p: PaymentInfo): Promise<void> {
  await pool.query(
    `UPDATE runs SET payment_amount = $2, payer = $3, payment_tx = $4 WHERE id = $1`,
    [runId, p.amount.toString(), p.payer, p.tx],
  );
}

export interface EarningRow {
  skill_slug: string;
  payment_amount: string;
  payer: string;
  payment_tx: string;
  started_at: string;
}
export interface EarningsSummary {
  totalAtomic: bigint;
  recent: EarningRow[];
}
export async function earningsSummary(pool: Queryable, handle: string, limit = 10): Promise<EarningsSummary> {
  const sum = await pool.query(
    `SELECT COALESCE(SUM(payment_amount), 0) AS total FROM runs WHERE agent_handle = $1 AND payment_amount IS NOT NULL`,
    [handle],
  );
  const recent = await pool.query(
    `SELECT skill_slug, payment_amount, payer, payment_tx, started_at
     FROM runs WHERE agent_handle = $1 AND payment_amount IS NOT NULL
     ORDER BY started_at DESC LIMIT $2`,
    [handle, limit],
  );
  return { totalAtomic: BigInt(String(sum.rows[0].total)), recent: recent.rows as unknown as EarningRow[] };
}
