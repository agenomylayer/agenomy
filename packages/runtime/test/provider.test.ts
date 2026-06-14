import { describe, it, expect } from "vitest";
import { chat } from "../src/provider";

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    status: ok ? 200 : 500,
    text: async () => "upstream error",
    json: async () => body,
  })) as any;
}

const cfg = { baseUrl: "https://u/v1", apiKey: "k", model: "m" };

describe("chat", () => {
  it("parses content + tool_calls + usage", async () => {
    const f = fakeFetch({
      choices: [
        {
          message: {
            content: "hi",
            tool_calls: [{ id: "c1", function: { name: "t", arguments: '{"a":1}' } }],
          },
        },
      ],
      usage: { prompt_tokens: 3, completion_tokens: 4 },
    });
    const r = await chat([{ role: "user", content: "x" }], [], cfg, f);
    expect(r.content).toBe("hi");
    expect(r.toolCalls[0].name).toBe("t");
    expect(r.toolCalls[0].args).toEqual({ a: 1 });
    expect(r.tokensIn).toBe(3);
    expect(r.tokensOut).toBe(4);
  });
  it("throws on a non-ok response", async () => {
    await expect(chat([], [], cfg, fakeFetch({}, false))).rejects.toThrow(/LLM 500/);
  });
});
