import type { SkillRow } from './mapSkills';

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: unknown[] }>;
}

const UPSERT_SQL = `INSERT INTO skills (slug, name, description, category, tags, source)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  source = EXCLUDED.source`;

/**
 * Idempotently upserts skill rows. Safe to run repeatedly: ON CONFLICT (slug)
 * refreshes mutable columns. Returns the number of rows processed.
 */
export async function upsertSkills(pool: QueryablePool, rows: SkillRow[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    await pool.query(UPSERT_SQL, [
      r.slug,
      r.name,
      r.description,
      r.category,
      JSON.stringify(r.tags),
      r.source,
    ]);
    n += 1;
  }
  return n;
}
