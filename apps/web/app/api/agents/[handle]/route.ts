import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import { toAgentDetail } from '../../../../lib/rows';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const pool = getPool();
  const res = await pool.query(
    `SELECT agent_id, owner, wallet, handle, skills, created_at,
            manifest_hash, manifest_cid, config_hash, persona, solana_wallet
     FROM agents WHERE handle = $1 LIMIT 1`,
    [handle],
  );
  if ((res.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 });
  }
  return NextResponse.json({ agent: toAgentDetail(res.rows[0]) });
}
