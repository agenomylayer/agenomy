import { describe, it, expect } from "vitest";
import { runAgent } from "../src/agent";
import { makeRegistry } from "../src/tools/registry";
import type { Tool } from "../src/tools/types";

const gasTool: Tool = {
  name: "onchain_read",
  description: "x",
  parameters: { type: "object", properties: {} },
  run: async () => ({ ok: true, data: { gwei: 1.5 } }),
};

// scripted LLM: call 1 -> a tool_call; call 2 -> a final answer
function scriptedFetch(): typeof fetch {
  let n = 0;
  return (async () => {
    n += 1;
    const body =
      n === 1
        ? {
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    { id: "c1", function: { name: "onchain_read", arguments: '{"action":"gasPrice"}' } },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }
        : {
            choices: [{ message: { content: "Gas is 1.5 gwei.", tool_calls: [] } }],
            usage: { prompt_tokens: 20, completion_tokens: 8 },
          };
    return { ok: true, status: 200, text: async () => "", json: async () => body } as any;
  }) as any;
}

describe("runAgent", () => {
  it("calls a tool, then produces a final answer, recording the trace", async () => {
    const reg = makeRegistry([gasTool]);
    const r = await runAgent({
      skill: {
        slug: "s",
        name: "S",
        category: "onchain",
        tools: ["onchain_read"],
        schedule: null,
        inputs: "x",
        prompt: "You are {{persona}}. do it.",
      },
      persona: "Tester",
      input: "gas?",
      registry: reg,
      provider: { baseUrl: "x", apiKey: "k", model: "m" },
      toolCtx: { rpcUrl: "x", fetch } as any,
      fetchFn: scriptedFetch(),
    });
    expect(r.status).toBe("ok");
    expect(r.output).toBe("Gas is 1.5 gwei.");
    expect(r.tokensIn).toBe(30);
    expect(r.tokensOut).toBe(13);
    expect(r.trace.find((t) => t.type === "tool_call")?.name).toBe("onchain_read");
    expect(r.trace.find((t) => t.type === "tool_result")).toBeTruthy();
  });

  it("injects the memory block into the system prompt when provided", async () => {
    let systemSeen = "";
    const capFetch: typeof fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      systemSeen = body.messages?.find((m: { role: string }) => m.role === "system")?.content ?? "";
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ choices: [{ message: { content: "done", tool_calls: [] } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
      } as any;
    }) as any;
    const r = await runAgent({
      skill: { slug: "s", name: "S", description: "", category: "onchain", tools: [], schedule: null, inputs: "x", prompt: "You are {{persona}}." },
      persona: "Scout",
      input: "go",
      memory: "## Memory\n- watch ETH",
      registry: makeRegistry([gasTool]),
      provider: { baseUrl: "x", apiKey: "k", model: "m" },
      toolCtx: { rpcUrl: "x", fetch } as any,
      fetchFn: capFetch,
    });
    expect(r.status).toBe("ok");
    expect(systemSeen).toContain("## Memory");
    expect(systemSeen).toContain("watch ETH");
  });

  it("stops with an error if it exceeds maxSteps", async () => {
    // a fetch that always returns a tool_call -> never terminates
    const loopFetch: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({
          choices: [
            { message: { content: null, tool_calls: [{ id: "c", function: { name: "onchain_read", arguments: "{}" } }] } },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      }) as any) as any;
    const r = await runAgent({
      skill: { slug: "s", name: "S", category: "onchain", tools: ["onchain_read"], schedule: null, inputs: "x", prompt: "p" },
      persona: "",
      input: "x",
      registry: makeRegistry([gasTool]),
      provider: { baseUrl: "x", apiKey: "k", model: "m" },
      toolCtx: { rpcUrl: "x", fetch } as any,
      fetchFn: loopFetch,
      maxSteps: 2,
    });
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/exceeded/);
  });
});
