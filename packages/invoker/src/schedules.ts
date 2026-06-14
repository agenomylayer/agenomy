// packages/invoker/src/schedules.ts
import type { Queryable } from "./db";
import { nextRun } from "./cron";

export interface ScheduleRow {
  id: string;
  agent_handle: string;
  skill_slug: string;
  input: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
}

export interface NewSchedule {
  agentHandle: string;
  skillSlug: string;
  input: string;
  cron: string;
}

const COLS = `id, agent_handle, skill_slug, input, cron, enabled, last_run_at, next_run_at, created_at`;

export async function createSchedule(pool: Queryable, s: NewSchedule, from: Date): Promise<string> {
  const next = nextRun(s.cron, from);
  const res = await pool.query(
    `INSERT INTO schedules (agent_handle, skill_slug, input, cron, next_run_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [s.agentHandle, s.skillSlug, s.input, s.cron, next.toISOString()],
  );
  return String(res.rows[0].id);
}

export async function listSchedules(pool: Queryable, handle: string): Promise<ScheduleRow[]> {
  const res = await pool.query(
    `SELECT ${COLS} FROM schedules WHERE agent_handle = $1 ORDER BY created_at DESC`,
    [handle],
  );
  return res.rows as unknown as ScheduleRow[];
}

export async function countSchedules(pool: Queryable, handle: string): Promise<number> {
  const res = await pool.query(`SELECT count(*)::int AS n FROM schedules WHERE agent_handle = $1`, [handle]);
  return Number(res.rows[0].n);
}

export async function setScheduleEnabled(
  pool: Queryable,
  handle: string,
  id: string,
  enabled: boolean,
): Promise<void> {
  await pool.query(`UPDATE schedules SET enabled = $3 WHERE id = $1 AND agent_handle = $2`, [
    id,
    handle,
    enabled,
  ]);
}

export async function deleteSchedule(pool: Queryable, handle: string, id: string): Promise<void> {
  await pool.query(`DELETE FROM schedules WHERE id = $1 AND agent_handle = $2`, [id, handle]);
}

export async function dueSchedules(pool: Queryable, now: Date): Promise<ScheduleRow[]> {
  const res = await pool.query(
    `SELECT ${COLS} FROM schedules WHERE enabled AND next_run_at <= $1 ORDER BY next_run_at ASC LIMIT 50`,
    [now.toISOString()],
  );
  return res.rows as unknown as ScheduleRow[];
}

export async function claimNextRun(pool: Queryable, id: string, next: Date): Promise<void> {
  await pool.query(`UPDATE schedules SET next_run_at = $2 WHERE id = $1`, [id, next.toISOString()]);
}

export async function markRan(pool: Queryable, id: string, ranAt: Date): Promise<void> {
  await pool.query(`UPDATE schedules SET last_run_at = $2 WHERE id = $1`, [id, ranAt.toISOString()]);
}

export async function countScheduledRunsSince(pool: Queryable, since: Date): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM runs WHERE source = 'scheduled' AND started_at >= $1`,
    [since.toISOString()],
  );
  return Number(res.rows[0].n);
}
