import type { Tool, ToolContext, ToolResult } from "./tools/types";
import type { ToolRegistry } from "./tools/registry";
import type { SkillDef } from "./skills/types";
import { chat, type ProviderConfig, type ChatMessage, type ToolCall } from "./provider";

export interface RunAgentInput {
  skill: SkillDef;
  persona: string; // agent persona text injected into the prompt
  input: string; // user/task input
  registry: ToolRegistry; // available tools
  provider: ProviderConfig;
  toolCtx: ToolContext; // rpcUrl + fetch passed to tools
  fetchFn?: typeof fetch; // test seam for the provider call
  maxSteps?: number;
}

export interface TraceEntry {
  type: "tool_call" | "tool_result" | "final";
  name?: string;
  args?: unknown;
  result?: unknown;
  content?: string;
}

export interface RunAgentResult {
  status: "ok" | "error";
  output: string;
  trace: TraceEntry[];
  tokensIn: number;
  tokensOut: number;
  error?: string;
}

function rawToolCalls(calls: ToolCall[]) {
  return calls.map((c) => ({
    id: c.id,
    type: "function",
    function: { name: c.name, arguments: JSON.stringify(c.args) },
  }));
}

/** Drive an agent: skill prompt (persona-filled) + input -> tool-use loop -> final answer + trace. */
export async function runAgent(inp: RunAgentInput): Promise<RunAgentResult> {
  const maxSteps = inp.maxSteps ?? 6;
  const system = inp.skill.prompt.replace(/\{\{persona\}\}/g, inp.persona || "an autonomous agent");
  const tools = inp.skill.tools
    .map((n) => inp.registry.get(n))
    .filter((t): t is Tool => Boolean(t));
  const userContent =
    inp.input.trim() ||
    "Begin now. Use your tools to perform the task and report the result concisely.";
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];
  const trace: TraceEntry[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    for (let step = 0; step < maxSteps; step++) {
      const r = await chat(messages, tools, inp.provider, inp.fetchFn);
      tokensIn += r.tokensIn;
      tokensOut += r.tokensOut;
      if (r.toolCalls.length === 0) {
        const out = r.content ?? "";
        trace.push({ type: "final", content: out });
        return { status: "ok", output: out, trace, tokensIn, tokensOut };
      }
      messages.push({ role: "assistant", content: r.content, tool_calls: rawToolCalls(r.toolCalls) });
      for (const call of r.toolCalls) {
        trace.push({ type: "tool_call", name: call.name, args: call.args });
        const tool = inp.registry.get(call.name);
        const result: ToolResult = tool
          ? await tool.run(call.args, inp.toolCtx)
          : { ok: false, error: `unknown tool ${call.name}` };
        trace.push({ type: "tool_result", name: call.name, result });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(result),
        });
      }
    }
    return { status: "error", output: "", trace, tokensIn, tokensOut, error: `exceeded ${maxSteps} steps` };
  } catch (e) {
    return {
      status: "error",
      output: "",
      trace,
      tokensIn,
      tokensOut,
      error: e instanceof Error ? e.message : "run failed",
    };
  }
}
