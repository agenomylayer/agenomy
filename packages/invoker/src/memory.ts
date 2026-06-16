import { createHash } from "node:crypto";
import type { Queryable } from "./db";

export type MemoryKind = "auto" | "pinned";

export interface MemoryRow {
  id: string;
  agent_handle: string;
  kind: MemoryKind;
  content: string;
  content_hash: string;
  run_id: string | null;
  created_at: string;
}

export interface MemorySnapshot {
  cid: string;
  hash: string;
  entry_count: number;
  updated_at: string;
}

const AUTO_CAP = 50;
const AUTO_TRUNC = 240;

export function memoryHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function writeAutoMemory(
  pool: Queryable,
  p: { agentHandle: string; skillSlug: string; output: string; runId: string },
): Promise<void> {
  const text = p.output.trim();
  if (!text) return;
  const note = `${p.skillSlug}: ${text}`.slice(0, AUTO_TRUNC);
  await pool.query(
    `INSERT INTO memories (agent_handle, kind, content, content_hash, run_id) VALUES ($1, 'auto', $2, $3, $4)`,
    [p.agentHandle, note, memoryHash(note), p.runId],
  );
  await pool.query(
    `DELETE FROM memories WHERE agent_handle = $1 AND kind = 'auto' AND id NOT IN (
       SELECT id FROM memories WHERE agent_handle = $1 AND kind = 'auto' ORDER BY created_at DESC, id DESC LIMIT $2
     )`,
    [p.agentHandle, AUTO_CAP],
  );
}

export async function writePinnedMemory(pool: Queryable, p: { agentHandle: string; content: string }): Promise<string> {
  const content = p.content.trim();
  const res = await pool.query(
    `INSERT INTO memories (agent_handle, kind, content, content_hash) VALUES ($1, 'pinned', $2, $3) RETURNING id`,
    [p.agentHandle, content, memoryHash(content)],
  );
  return String(res.rows[0].id);
}

export async function listMemory(pool: Queryable, handle: string, limit = 100): Promise<MemoryRow[]> {
  const res = await pool.query(
    `SELECT id, agent_handle, kind, content, content_hash, run_id, created_at
     FROM memories WHERE agent_handle = $1
     ORDER BY (kind = 'pinned') DESC, created_at DESC, id DESC LIMIT $2`,
    [handle, limit],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    agent_handle: String(r.agent_handle),
    kind: r.kind as MemoryKind,
    content: String(r.content),
    content_hash: String(r.content_hash),
    run_id: r.run_id == null ? null : String(r.run_id),
    created_at: String(r.created_at),
  }));
}

export async function countMemory(pool: Queryable, handle: string): Promise<number> {
  const res = await pool.query(`SELECT COUNT(*)::int AS n FROM memories WHERE agent_handle = $1`, [handle]);
  return Number(res.rows[0]?.n ?? 0);
}

export async function deleteMemory(pool: Queryable, handle: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM memories WHERE agent_handle = $1 AND id = $2`, [handle, id]);
}

export async function buildMemoryContext(
  pool: Queryable,
  handle: string,
  opts: { autoLimit?: number; budget?: number } = {},
): Promise<string> {
  const autoLimit = opts.autoLimit ?? 8;
  const budget = opts.budget ?? 1500;
  const pinnedRes = await pool.query(
    `SELECT content FROM memories WHERE agent_handle = $1 AND kind = 'pinned' ORDER BY created_at ASC LIMIT 10`,
    [handle],
  );
  const autoRes = await pool.query(
    `SELECT content FROM memories WHERE agent_handle = $1 AND kind = 'auto' ORDER BY created_at DESC, id DESC LIMIT $2`,
    [handle, autoLimit],
  );
  const pinned = pinnedRes.rows.map((r) => String(r.content));
  const auto = autoRes.rows.map((r) => String(r.content));
  if (pinned.length === 0 && auto.length === 0) return "";
  let out = "## Memory\n";
  if (pinned.length) out += "What your owner pinned (treat as always true):\n" + pinned.map((c) => `- ${c}`).join("\n") + "\n";
  if (auto.length) out += "Recent activity (most recent first):\n" + auto.map((c) => `- ${c}`).join("\n") + "\n";
  return out.slice(0, budget).trim();
}

export async function getMemorySnapshot(pool: Queryable, handle: string): Promise<MemorySnapshot | null> {
  const res = await pool.query(
    `SELECT cid, hash, entry_count, updated_at FROM memory_snapshots WHERE agent_handle = $1 LIMIT 1`,
    [handle],
  );
  if ((res.rowCount ?? 0) === 0) return null;
  const r = res.rows[0];
  return { cid: String(r.cid), hash: String(r.hash), entry_count: Number(r.entry_count), updated_at: String(r.updated_at) };
}

export async function upsertMemorySnapshot(
  pool: Queryable,
  handle: string,
  s: { cid: string; hash: string; entryCount: number },
): Promise<void> {
  await pool.query(
    `INSERT INTO memory_snapshots (agent_handle, cid, hash, entry_count, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (agent_handle) DO UPDATE SET cid = EXCLUDED.cid, hash = EXCLUDED.hash, entry_count = EXCLUDED.entry_count, updated_at = now()`,
    [handle, s.cid, s.hash, s.entryCount],
  );
}
