import { NextResponse } from 'next/server';
import { validateHandleFormat } from '../../../../lib/handle';
import { getPool } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle');
  if (handle === null) {
    return NextResponse.json({ error: 'handle query param is required' }, { status: 400 });
  }

  const fmt = validateHandleFormat(handle);
  if (!fmt.ok) {
    return NextResponse.json({ available: false, reason: fmt.reason });
  }

  const pool = getPool();
  const res = await pool.query('SELECT handle FROM agents WHERE handle = $1 LIMIT 1', [handle]);
  if ((res.rowCount ?? 0) > 0) {
    return NextResponse.json({ available: false, reason: 'taken' });
  }
  return NextResponse.json({ available: true });
}
