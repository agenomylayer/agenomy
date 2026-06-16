import {
  runAgent,
  makeRegistry,
  onchainRead,
  marketData,
  loadSkillsFromDir,
  type ProviderConfig,
} from "@agenomy/runtime";
import type { Queryable } from "./db";
import { createRun, finishRun, type RunSource } from "./runs";
import { buildMemoryContext, writeAutoMemory } from "./memory";

export interface InvokeEnv {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  rpcUrl: string;
  skillsDir: string;
}

export type InvokeError = "agent_not_found" | "unknown_skill" | "llm_not_configured";

export interface InvokeOpts {
  pool: Queryable;
  handle: string;
  skillSlug: string;
  input: string;
  source: RunSource;
  env: InvokeEnv;
  fetchFn?: typeof fetch; // test seam for the provider call
}

export interface InvokeResult {
  runId?: string;
  status: "ok" | "error";
  output: string;
  trace: unknown[];
  error?: string;
  invokeError?: InvokeError;
}

const TOOLS = [onchainRead, marketData];

function fail(error: string, invokeError: InvokeError): InvokeResult {
  return { status: "error", output: "", trace: [], error, invokeError };
}

/** The single agent-run code path. Used by the web run route (manual) and the scheduler (scheduled). */
export async function invokeSkillRun(opts: InvokeOpts): Promise<InvokeResult> {
  const { pool, handle, skillSlug, input, source, env } = opts;

  const ares = await pool.query(`SELECT persona FROM agents WHERE handle = $1 LIMIT 1`, [handle]);
  if ((ares.rowCount ?? 0) === 0) return fail("agent not found", "agent_not_found");
  const p = (ares.rows[0].persona ?? {}) as { displayName?: string; bio?: string };
  const persona = [p.displayName, p.bio].filter(Boolean).join(". ") || handle;

  const registry = makeRegistry(TOOLS);
  const skill = loadSkillsFromDir(env.skillsDir, registry.names()).find((s) => s.slug === skillSlug);
  if (!skill) return fail(`unknown skill: ${skillSlug}`, "unknown_skill");

  const provider: ProviderConfig = { baseUrl: env.llmBaseUrl, apiKey: env.llmApiKey, model: env.llmModel };
  if (!provider.baseUrl || !provider.apiKey || !provider.model) {
    return fail("LLM not configured", "llm_not_configured");
  }

  const memory = await buildMemoryContext(pool, handle);
  const runId = await createRun(pool, { agentHandle: handle, skillSlug, input, source });
  const result = await runAgent({
    skill,
    persona,
    input,
    memory,
    registry,
    provider,
    toolCtx: { rpcUrl: env.rpcUrl, fetch },
    fetchFn: opts.fetchFn,
  });
  await finishRun(pool, runId, {
    status: result.status,
    output: result.output,
    trace: result.trace,
    model: provider.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    error: result.error,
  });

  if (result.status === "ok") {
    try {
      await writeAutoMemory(pool, { agentHandle: handle, skillSlug, output: result.output, runId });
    } catch {
      /* memory must never fail a run */
    }
  }

  return { runId, status: result.status, output: result.output, trace: result.trace, error: result.error };
}
