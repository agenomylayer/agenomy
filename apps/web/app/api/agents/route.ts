import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { toAgentSummary } from '../../../lib/rows';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const skill = url.searchParams.get('skill');
  const category = url.searchParams.get('category');
  const sort = url.searchParams.get('sort') ?? 'recent';

  let limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let offset = Number(url.searchParams.get('offset') ?? 0);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const pool = getPool();
  const where: string[] = [];
  const values: unknown[] = [];

  if (skill) {
    values.push(JSON.stringify([skill]));
    where.push(`a.skills @> $${values.length}::jsonb`);
  }

  if (category) {
    // Resolve slugs in the category, then require overlap with the agent's skills.
    values.push(category);
    where.push(
      `EXISTS (
         SELECT 1 FROM skills s
         WHERE s.category = $${values.length}
           AND a.skills @> to_jsonb(s.slug)
       )`,
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = sort === 'recent' ? 'ORDER BY created_at DESC' : 'ORDER BY agent_id ASC';

  // Page query
  const pageValues = [...values, limit, offset];
  const limitParam = `$${pageValues.length - 1}`;
  const offsetParam = `$${pageValues.length}`;
  const pageSql = `SELECT a.agent_id, a.owner, a.wallet, a.handle, a.skills, a.created_at
                   FROM agents a
                   ${whereSql}
                   ${orderSql}
                   LIMIT ${limitParam} OFFSET ${offsetParam}`;
  const pageRes = await pool.query(pageSql, pageValues);

  // Count query (same filters, no paging)
  const countSql = `SELECT COUNT(*)::text AS total FROM agents a ${whereSql}`;
  const countRes = await pool.query(countSql, values);
  const total = Number(countRes.rows[0]?.total ?? 0);

  return NextResponse.json({
    agents: pageRes.rows.map(toAgentSummary),
    total,
  });
}
