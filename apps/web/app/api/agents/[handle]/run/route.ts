import { NextResponse } from "next/server";
import { join } from "node:path";
import { invokeSkillRun, getPrice, recordPayment, type InvokeEnv } from "@agenomy/invoker";
import { getPool } from "../../../../../lib/db";
import { buildRequirements, paymentRequiredBody, verifyPayment, settlePayment } from "../../../../../lib/x402";

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

  const pool = getPool();

  // Pricing gate (manual web runs only; scheduled runs call invokeSkillRun directly and bypass this).
  const price = await getPrice(pool, handle);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let requirements: any[] | null = null;
  let payer = "";
  const xPayment = request.headers.get("X-PAYMENT") ?? "";

  if (price > 0n) {
    const ares = await pool.query(`SELECT wallet FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
    if ((ares.rowCount ?? 0) === 0) return NextResponse.json({ error: "agent not found" }, { status: 404 });
    const payTo = String(ares.rows[0].wallet) as `0x${string}`;

    try {
      requirements = await buildRequirements(payTo, price);
    } catch (e) {
      return NextResponse.json({ error: "payment service unavailable", detail: String(e) }, { status: 503 });
    }

    const v = await verifyPayment(xPayment, requirements);
    if (!v.valid) {
      return NextResponse.json(paymentRequiredBody(requirements), { status: 402 });
    }
    payer = v.payer ?? "";
  }

  const r = await invokeSkillRun({ pool, handle, skillSlug, input, source: "manual", env: runEnv() });

  if (r.invokeError === "agent_not_found") return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (r.invokeError === "unknown_skill") return NextResponse.json({ error: `unknown skill: ${skillSlug}` }, { status: 400 });
  if (r.invokeError === "llm_not_configured") return NextResponse.json({ error: "LLM not configured" }, { status: 503 });

  // Settle only after a successful run; record the earning on the run.
  let paymentTx: string | undefined;
  if (requirements && r.status === "ok" && r.runId) {
    try {
      const s = await settlePayment(xPayment, requirements);
      paymentTx = s.txHash;
      await recordPayment(pool, r.runId, { amount: price, payer: payer || s.payer || "", tx: s.txHash });
    } catch (e) {
      // Run succeeded but settlement failed: surface it; do not fabricate an earning.
      return NextResponse.json({ runId: r.runId, status: r.status, output: r.output, trace: r.trace, settleError: String(e) });
    }
  }

  return NextResponse.json({
    runId: r.runId,
    status: r.status,
    output: r.output,
    trace: r.trace,
    error: r.error,
    paymentTx,
  });
}
