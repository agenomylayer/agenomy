import type { Persona } from '@agenomy/shared';

export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}

export interface AgentInsert {
  agentId: bigint;
  owner: string;
  wallet: string;
  handle: string;
  manifestHash: string;
  manifestCid: string | null;
  configHash: string;
  persona: Persona | null;
  skills: string[];
  createdAt: bigint;
  blockNumber: bigint;
  txHash: string;
}

export async function getLastBlock(pool: QueryablePool): Promise<bigint | null> {
  const res = await pool.query('SELECT last_block FROM indexer_state WHERE id = 1');
  if (res.rows.length === 0) return null;
  const v = res.rows[0].last_block as string | number | bigint;
  return BigInt(v as string);
}

export async function setLastBlock(pool: QueryablePool, block: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (id, last_block)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET last_block = EXCLUDED.last_block`,
    [block.toString()],
  );
}

const UPSERT_AGENT_SQL = `INSERT INTO agents (
  agent_id, owner, wallet, handle, manifest_hash, manifest_cid,
  config_hash, persona, skills, created_at, block_number, tx_hash
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8::jsonb, $9::jsonb, $10, $11, $12
)
ON CONFLICT (agent_id) DO NOTHING`;

export async function upsertAgent(pool: QueryablePool, a: AgentInsert): Promise<boolean> {
  const res = await pool.query(UPSERT_AGENT_SQL, [
    a.agentId.toString(),
    a.owner,
    a.wallet,
    a.handle,
    a.manifestHash,
    a.manifestCid,
    a.configHash,
    a.persona === null ? null : JSON.stringify(a.persona),
    JSON.stringify(a.skills),
    a.createdAt.toString(),
    a.blockNumber.toString(),
    a.txHash,
  ]);
  return (res.rowCount ?? 0) > 0;
}
