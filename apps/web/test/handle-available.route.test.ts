import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/agents/handle-available/route';
import { __setPoolForTests } from '../lib/db';

function req(handle?: string) {
  const u = new URL('http://localhost/api/agents/handle-available');
  if (handle !== undefined) u.searchParams.set('handle', handle);
  return new Request(u);
}

beforeEach(() => __setPoolForTests(null));

describe('GET /api/agents/handle-available', () => {
  it('returns available:false with reason for a format-invalid handle (no DB hit)', async () => {
    let queried = false;
    __setPoolForTests({
      async query() {
        queried = true;
        return { rowCount: 0, rows: [] };
      },
    });
    const res = await GET(req('AB'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, reason: 'invalid_length' });
    expect(queried).toBe(false);
  });

  it('returns available:false reason invalid_charset for bad chars', async () => {
    __setPoolForTests({ async query() { return { rowCount: 0, rows: [] }; } });
    const res = await GET(req('a_b'));
    expect(await res.json()).toEqual({ available: false, reason: 'invalid_charset' });
  });

  it('returns available:true when format-valid and not in DB', async () => {
    __setPoolForTests({ async query() { return { rowCount: 0, rows: [] }; } });
    const res = await GET(req('satoshi'));
    expect(await res.json()).toEqual({ available: true });
  });

  it('returns available:false reason taken when handle exists in DB', async () => {
    __setPoolForTests({ async query() { return { rowCount: 1, rows: [{ handle: 'satoshi' }] }; } });
    const res = await GET(req('satoshi'));
    expect(await res.json()).toEqual({ available: false, reason: 'taken' });
  });

  it('returns 400 when handle param is missing', async () => {
    const res = await GET(req(undefined));
    expect(res.status).toBe(400);
  });
});
