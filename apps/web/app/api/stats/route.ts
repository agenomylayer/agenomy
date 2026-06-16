import { NextResponse } from "next/server";
import { join } from "node:path";
import { makeRegistry, onchainRead, marketData, loadSkillsFromDir } from "@agenomy/runtime";
import { getPool } from "../../../lib/db";

export const dynamic = "force-dynamic";

const SKILLS_DIR = process.env.SKILLS_DIR || join(process.cwd(), "../../skills");
const registry = makeRegistry([onchainRead, marketData]);

export async function GET(): Promise<Response> {
  const pool = getPool();
  const [agents, runs, settled] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM agents`),
    pool.query(`SELECT COUNT(*)::int AS n FROM runs`),
    pool.query(`SELECT COALESCE(SUM(payment_amount), 0)::text AS s FROM runs WHERE payment_amount IS NOT NULL`),
  ]);
  const skills = loadSkillsFromDir(SKILLS_DIR, registry.names()).length;
  return NextResponse.json({
    agents: Number(agents.rows[0]?.n ?? 0),
    runs: Number(runs.rows[0]?.n ?? 0),
    skills,
    settledAtomic: String(settled.rows[0]?.s ?? "0"),
  });
}
