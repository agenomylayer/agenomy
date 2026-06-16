import { NextResponse } from "next/server";
import { deleteMemory } from "@agenomy/invoker";
import { getPool } from "../../../../../../lib/db";
import { memoryDeleteMessage, verifyOwnerSignedMessage } from "../../../../../../lib/owner-auth";
import { anchorMemory } from "../../../../../../lib/memory-snapshot";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ handle: string; id: string }> },
): Promise<Response> {
  const { handle, id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { ts?: number; signature?: string };
  const ts = Number(body.ts);
  const signature = String(body.signature ?? "") as `0x${string}`;

  const pool = getPool();
  const ares = await pool.query(`SELECT owner FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const owner = String(ares.rows[0].owner);

  const ok = await verifyOwnerSignedMessage({
    message: memoryDeleteMessage(handle, id, ts),
    signature,
    owner,
    ts,
    now: Math.floor(Date.now() / 1000),
  });
  if (!ok) return NextResponse.json({ error: "not authorized" }, { status: 401 });

  await deleteMemory(pool, handle, id);
  let snapshot = null;
  try {
    snapshot = await anchorMemory(handle);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true, snapshot });
}
