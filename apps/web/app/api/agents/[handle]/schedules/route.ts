import { NextResponse } from "next/server";
import { join } from "node:path";
import { makeRegistry, onchainRead, marketData, loadSkillsFromDir } from "@agenomy/runtime";
import { createSchedule, listSchedules, countSchedules, validateCron } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

const SKILLS_DIR = process.env.SKILLS_DIR || join(process.cwd(), "../../skills");
const MAX_PER_AGENT = 10;

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const schedules = await listSchedules(getPool(), handle);
  return NextResponse.json({ schedules });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    skillSlug?: string;
    input?: string;
    cron?: string;
  };
  const skillSlug = String(body.skillSlug ?? "");
  const input = String(body.input ?? "");
  const cron = String(body.cron ?? "").trim();
  if (!skillSlug || !cron)
    return NextResponse.json({ error: "skillSlug and cron required" }, { status: 400 });

  const v = validateCron(cron);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const registry = makeRegistry([onchainRead, marketData]);
  const known = loadSkillsFromDir(SKILLS_DIR, registry.names()).some((s) => s.slug === skillSlug);
  if (!known) return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });

  const pool = getPool();
  const ares = await pool.query(`SELECT 1 FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0)
    return NextResponse.json({ error: "agent not found" }, { status: 404 });

  if ((await countSchedules(pool, handle)) >= MAX_PER_AGENT)
    return NextResponse.json({ error: `max ${MAX_PER_AGENT} schedules per agent` }, { status: 400 });

  const id = await createSchedule(pool, { agentHandle: handle, skillSlug, input, cron }, new Date());
  return NextResponse.json({ id }, { status: 201 });
}
