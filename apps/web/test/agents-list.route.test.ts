import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/agents/route';
import { __setPoolForTests } from '../lib/db';

interface Call { text: string; values: unknown[] }

function multiPool(resultsByCall: { rowCount: number; rows: Record<string, unknown>[] }[]) {
  const calls: Call[] = [];
  let i = 0;
  return {
    calls,
    pool: {
      async query(text: string, values: unknown[] = []) {
        calls.push({ text, values });
        const r = resultsByCall[i] ?? { rowCount: 0, rows: [] };
        i += 1;
        return r;
      },
    },
  };
}

function req(qs: string) {
  return new Request(new URL(`http://localhost/api/agents${qs}`));
}

beforeEach(() => __setPoolForTests(null));

const agentRow = {
  agent_id: '1',
  owner: '0x1111111111111111111111111111111111111111',
  wallet: '0x2222222222222222222222222222222222222222',
  handle: 'satoshi',
  skills: ['action-converter'],
  created_at: '1700000000',
};

describe('GET /api/agents', () => {
  it('returns { agents, total } with summaries and count', async () => {
    const c = multiPool([
      { rowCount: 1, rows: [agentRow] },
      { rowCount: 1, rows: [{ total: '1' }] },
    ]);
    __setPoolForTests(c.pool);
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.agents).toEqual([
      {
        agentId: '1',
        handle: 'satoshi',
        owner: '0x1111111111111111111111111111111111111111',
        wallet: '0x2222222222222222222222222222222222222222',
        skills: ['action-converter'],
        createdAt: 1700000000,
      },
    ]);
  });

  it('filters by skill using a jsonb containment param', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?skill=agent-buzz'));
    expect(c.calls[0].text).toContain('skills @>');
    expect(c.calls[0].values).toContain(JSON.stringify(['agent-buzz']));
  });

  it('joins skills->skills table when filtering by category', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?category=social'));
    expect(c.calls[0].text).toContain('category');
    expect(c.calls[0].values).toContain('social');
  });

  it('applies limit and offset (defaults limit=24, offset=0) and recent sort', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?sort=recent&limit=5&offset=10'));
    expect(c.calls[0].text).toContain('ORDER BY created_at DESC');
    expect(c.calls[0].values).toEqual(expect.arrayContaining([5, 10]));
  });
});
