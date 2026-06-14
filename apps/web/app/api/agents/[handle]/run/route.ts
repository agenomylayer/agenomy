import { NextResponse } from "next/server";
import { join } from "node:path";
import { invokeSkillRun, type InvokeEnv } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function runEnv(): InvokeEnv {
  return {
    llmBaseUrl: process.env.LLM_BASE_URL ?? "",
    llmApiKey: process.env.LLM_API_KEY ?? "",
    llmModel: process.env.LLM_MODEL ?? "",
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    skillsDir: process.env.SKILLS_DIR || join(process.cwd(), "../../skills"),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { skillSlug?: string; input?: string };
  const skillSlug = String(body.skillSlug ?? "");
  const input = String(body.input ?? "");
  if (!skillSlug) return NextResponse.json({ error: "skillSlug required" }, { status: 400 });

  const r = await invokeSkillRun({
    pool: getPool(),
    handle,
    skillSlug,
    input,
    source: "manual",
    env: runEnv(),
  });

  if (r.invokeError === "agent_not_found")
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (r.invokeError === "unknown_skill")
    return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });
  if (r.invokeError === "llm_not_configured")
    return NextResponse.json({ error: "LLM not configured" }, { status: 503 });

  return NextResponse.json({
    runId: r.runId,
    status: r.status,
    output: r.output,
    trace: r.trace,
    error: r.error,
  });
}
