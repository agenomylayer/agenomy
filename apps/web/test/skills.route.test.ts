import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/skills/route';
import { __setPoolForTests } from '../lib/db';

interface Call { text: string; values: unknown[] }

function capturePool(rows: Record<string, unknown>[]) {
  const calls: Call[] = [];
  return {
    calls,
    pool: {
      async query(text: string, values: unknown[] = []) {
        calls.push({ text, values });
        return { rowCount: rows.length, rows };
      },
    },
  };
}

function req(qs: string) {
  return new Request(new URL(`http://localhost/api/skills${qs}`));
}

beforeEach(() => __setPoolForTests(null));

const dbRows = [
  {
    slug: 'action-converter',
    name: 'Action Converter',
    description: 'desc',
    category: 'productivity',
    tags: [],
  },
];

describe('GET /api/skills', () => {
  it('returns { skills } mapped to the Skill shape', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      skills: [
        {
          slug: 'action-converter',
          name: 'Action Converter',
          description: 'desc',
          category: 'productivity',
          tags: [],
        },
      ],
    });
  });

  it('adds a category filter param when ?category= is present', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?category=productivity'));
    expect(c.calls[0].text).toContain('category =');
    expect(c.calls[0].values).toContain('productivity');
  });

  it('adds an ILIKE search on name/description when ?q= is present', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?q=tweet'));
    expect(c.calls[0].text).toContain('ILIKE');
    expect(c.calls[0].values).toContain('%tweet%');
  });

  it('combines category and q filters', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?category=social&q=buzz'));
    expect(c.calls[0].values).toEqual(expect.arrayContaining(['social', '%buzz%']));
  });
});
