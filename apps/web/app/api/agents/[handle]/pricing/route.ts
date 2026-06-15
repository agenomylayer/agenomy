import { NextResponse } from "next/server";
import { getPrice, setPrice } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";
import { verifyOwnerSig } from "../../../../../lib/owner-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const priceAtomic = await getPrice(getPool(), handle);
  return NextResponse.json({ priceAtomic: priceAtomic.toString() });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { priceAtomic?: string; ts?: number; signature?: string };
  let priceAtomic: bigint;
  try {
    priceAtomic = BigInt(String(body.priceAtomic ?? ""));
    if (priceAtomic < 0n) throw new Error("negative");
  } catch {
    return NextResponse.json({ error: "invalid priceAtomic" }, { status: 400 });
  }
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSig({
    handle,
    priceAtomic,
    ts,
    signature,
    owner,
    now: Math.floor(Date.now() / 1000),
  });
  if (!ok) return NextResponse.json({ error: "not authorized (owner signature required)" }, { status: 401 });

  await setPrice(pool, handle, priceAtomic);
  return NextResponse.json({ ok: true, priceAtomic: priceAtomic.toString() });
}
