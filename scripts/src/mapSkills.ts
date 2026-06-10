export interface AeonSkillEntry {
  slug?: string;
  name?: string;
  description?: string;
  category?: string | null;
  [k: string]: unknown;
}

export interface AeonCatalog {
  version?: string;
  generated?: string;
  repo?: string;
  total?: number;
  categories?: string[];
  skills: AeonSkillEntry[];
  [k: string]: unknown;
}

export interface SkillRow {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  source: string;
}

/**
 * Pure mapping from the Aeon catalog object to the rows we upsert into `skills`.
 * The catalog drifts (197 today, may change) — we count from the array, never the
 * `total` field. Aeon entries carry no `tags`, so tags default to []. source = 'aeon'.
 */
export function mapSkills(catalog: AeonCatalog): SkillRow[] {
  const entries = Array.isArray(catalog.skills) ? catalog.skills : [];
  const rows: SkillRow[] = [];
  for (const e of entries) {
    if (!e || typeof e.slug !== 'string' || e.slug.length === 0) continue;
    rows.push({
      slug: e.slug,
      name: typeof e.name === 'string' ? e.name : e.slug,
      description: typeof e.description === 'string' ? e.description : '',
      category:
        typeof e.category === 'string' && e.category.length > 0 ? e.category : null,
      tags: [],
      source: 'aeon',
    });
  }
  return rows;
}
