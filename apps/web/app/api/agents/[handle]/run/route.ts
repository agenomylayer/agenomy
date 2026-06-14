import { NextResponse } from "next/server";
import { join } from "node:path";
import {
  runAgent,
  makeRegistry,
  onchainRead,
  marketData,
  loadSkillsFromDir,
} from "@agenomy/runtime";
import { getPool } from "../../../../../lib/db";
import { createRun, finishRun } from "../../../../../lib/runs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SKILLS_DIR = process.env.SKILLS_DIR || join(process.cwd(), "../../skills");
const TOOLS = [onchainRead, marketData];

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { skillSlug?: string; input?: string };
  const skillSlug = String(body.skillSlug ?? "");
  const input = String(body.input ?? "");
  if (!skillSlug) return NextResponse.json({ error: "skillSlug required" }, { status: 400 });

  // agent persona
  const ares = await getPool().query(`SELECT persona FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const p = (ares.rows[0].persona ?? {}) as { displayName?: string; bio?: string };
  const persona = [p.displayName, p.bio].filter(Boolean).join(". ") || handle;

  // skill
  const registry = makeRegistry(TOOLS);
  const skill = loadSkillsFromDir(SKILLS_DIR, registry.names()).find((s) => s.slug === skillSlug);
  if (!skill) return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });

  // provider (model-agnostic, from env)
  const provider = {
    baseUrl: process.env.LLM_BASE_URL ?? "",
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "",
  };
  if (!provider.baseUrl || !provider.apiKey || !provider.model) {
    return NextResponse.json({ error: "LLM not configured" }, { status: 503 });
  }

  const runId = await createRun({ agentHandle: handle, skillSlug, input });
  const result = await runAgent({
    skill,
    persona,
    input,
    registry,
    provider,
    toolCtx: { rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org", fetch },
  });
  await finishRun(runId, {
    status: result.status,
    output: result.output,
    trace: result.trace,
    model: provider.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    error: result.error,
  });

  return NextResponse.json({
    runId,
    status: result.status,
    output: result.output,
    trace: result.trace,
    error: result.error,
  });
}
