import { NextResponse } from "next/server";
import { listMemory, writePinnedMemory, getMemorySnapshot, memoryHash } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";
import { memoryPinMessage, verifyOwnerSignedMessage } from "../../../../../lib/owner-auth";
import { anchorMemory } from "../../../../../lib/memory-snapshot";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const pool = getPool();
  const [entries, snapshot] = await Promise.all([listMemory(pool, handle, 200), getMemorySnapshot(pool, handle)]);
  return NextResponse.json({ entries, snapshot });
}

export async function POST(request: Request, context: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { content?: string; ts?: number; signature?: string };
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: "content too long (max 500)" }, { status: 400 });
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSignedMessage({
    message: memoryPinMessage(handle, memoryHash(content), ts),
    signature,
    owner,
    ts,
    now: Math.floor(Date.now() / 1000),
  });
  if (!ok) return NextResponse.json({ error: "not authorized (owner signature required)" }, { status: 401 });

  const id = await writePinnedMemory(pool, { agentHandle: handle, content });
  let snapshot = null;
  try {
    snapshot = await anchorMemory(handle);
  } catch {
    /* pin failure shouldn't block the write */
  }
  return NextResponse.json({ ok: true, id, snapshot });
}
