import { describe, it, expect, vi } from 'vitest';
import { upsertSkills } from '../src/upsertSkills';
import type { SkillRow } from '../src/mapSkills';

interface Call {
  text: string;
  values: unknown[];
}

function fakePool() {
  const calls: Call[] = [];
  const pool = {
    calls,
    async query(text: string, values: unknown[]) {
      calls.push({ text, values });
      return { rowCount: 1, rows: [] };
    },
  };
  return pool;
}

const rows: SkillRow[] = [
  {
    slug: 'action-converter',
    name: 'Action Converter',
    description: 'desc one',
    category: 'productivity',
    tags: [],
    source: 'aeon',
  },
  {
    slug: 'no-category-skill',
    name: 'No Category Skill',
    description: 'desc two',
    category: null,
    tags: [],
    source: 'aeon',
  },
];

describe('upsertSkills', () => {
  it('issues one parameterized upsert per row with ON CONFLICT DO UPDATE', async () => {
    const pool = fakePool();
    const n = await upsertSkills(pool as any, rows);
    expect(n).toBe(2);
    expect(pool.calls).toHaveLength(2);

    const first = pool.calls[0];
    expect(first.text).toContain('INSERT INTO skills');
    expect(first.text).toContain('ON CONFLICT (slug) DO UPDATE');
    expect(first.text).toContain('$1');
    expect(first.text).toContain('$6');
    // params order: slug, name, description, category, tags(jsonb text), source
    expect(first.values[0]).toBe('action-converter');
    expect(first.values[1]).toBe('Action Converter');
    expect(first.values[2]).toBe('desc one');
    expect(first.values[3]).toBe('productivity');
    expect(first.values[4]).toBe('[]');
    expect(first.values[5]).toBe('aeon');
  });

  it('passes null category through as a bound param', async () => {
    const pool = fakePool();
    await upsertSkills(pool as any, rows);
    expect(pool.calls[1].values[3]).toBeNull();
  });

  it('is idempotent: running twice issues the same statements and never throws', async () => {
    const pool = fakePool();
    await upsertSkills(pool as any, rows);
    await upsertSkills(pool as any, rows);
    expect(pool.calls).toHaveLength(4);
    expect(pool.calls[0].text).toBe(pool.calls[2].text);
  });
});
