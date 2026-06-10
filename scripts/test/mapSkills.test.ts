import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapSkills, type SkillRow, type AeonCatalog } from '../src/mapSkills';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'skills.sample.json'), 'utf8'),
) as AeonCatalog;

describe('mapSkills', () => {
  it('maps every entry in the skills array (count from array, not the total field)', () => {
    const rows = mapSkills(catalog);
    expect(rows).toHaveLength(catalog.skills.length);
    expect(rows).toHaveLength(3);
  });

  it('maps slug/name/description verbatim and category as-is', () => {
    const rows = mapSkills(catalog);
    const row = rows.find((r) => r.slug === 'action-converter') as SkillRow;
    expect(row).toEqual({
      slug: 'action-converter',
      name: 'Action Converter',
      description:
        '5 concrete real-life actions, leverage-scored against open loops with specificity and anti-fluff gates',
      category: 'productivity',
      tags: [],
      source: 'aeon',
    });
  });

  it('defaults missing category to null and tags to empty array', () => {
    const rows = mapSkills(catalog);
    const row = rows.find((r) => r.slug === 'no-category-skill') as SkillRow;
    expect(row.category).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.source).toBe('aeon');
  });

  it('skips entries with no slug', () => {
    const dirty: AeonCatalog = {
      ...catalog,
      skills: [...catalog.skills, { name: 'Bad', description: 'no slug' } as any],
    };
    const rows = mapSkills(dirty);
    expect(rows).toHaveLength(3);
  });
});
