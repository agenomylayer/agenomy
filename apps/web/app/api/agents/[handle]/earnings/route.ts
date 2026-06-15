import { NextResponse } from "next/server";
import { earningsSummary } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";
import { readUsdcBalanceAtomic } from "../../../../../lib/usdc";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const pool = getPool();
  const ares = await pool.query(`SELECT wallet FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const wallet = String(ares.rows[0].wallet);

  const summary = await earningsSummary(pool, handle);
  let walletBalanceAtomic = "0";
  try {
    walletBalanceAtomic = (
      await readUsdcBalanceAtomic(wallet, process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org")
    ).toString();
  } catch {
    // leave as "0" if the RPC read fails; do not fabricate
  }

  return NextResponse.json({
    wallet,
    walletBalanceAtomic,
    totalEarnedAtomic: summary.totalAtomic.toString(),
    recent: summary.recent,
  });
}
