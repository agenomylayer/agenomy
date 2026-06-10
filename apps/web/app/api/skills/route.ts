import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { toSkill } from '../../../lib/rows';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');

  const where: string[] = [];
  const values: unknown[] = [];

  if (category) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(`(name ILIKE ${p} OR description ILIKE ${p})`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT slug, name, description, category, tags
               FROM skills ${whereSql}
               ORDER BY name ASC`;

  const pool = getPool();
  const res = await pool.query(sql, values);
  return NextResponse.json({ skills: res.rows.map(toSkill) });
}
