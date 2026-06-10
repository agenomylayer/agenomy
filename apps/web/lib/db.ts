import { Pool } from 'pg';

export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}

let _pool: Pool | null = null;
let _override: QueryablePool | null = null;

/** Test seam: inject a fake pool. Pass null to clear. */
export function __setPoolForTests(p: QueryablePool | null): void {
  _override = p;
}

export function getPool(): QueryablePool {
  if (_override) return _override;
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    _pool = new Pool({ connectionString });
  }
  return _pool;
}
