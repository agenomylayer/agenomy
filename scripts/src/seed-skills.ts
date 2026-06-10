import { Pool } from 'pg';
import { mapSkills, type AeonCatalog } from './mapSkills';
import { upsertSkills } from './upsertSkills';

const CATALOG_URL =
  process.env.AEON_SKILLS_URL ??
  'https://raw.githubusercontent.com/aaronjmars/aeon/main/skills.json';

async function fetchCatalog(url: string): Promise<AeonCatalog> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Aeon skills.json: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AeonCatalog;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const catalog = await fetchCatalog(CATALOG_URL);
  const rows = mapSkills(catalog);
  // Read the count from the data, never hardcode (catalog drifts; ~197 today).
  console.log(
    `Aeon catalog: total field = ${catalog.total ?? 'n/a'}, mapped rows = ${rows.length}`,
  );

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    const n = await upsertSkills(pool, rows);
    await pool.query('COMMIT');
    console.log(`Seeded ${n} skills.`);
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
