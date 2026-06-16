import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { invokeSkillRun } from "../src/invoke";
import { fakePool } from "./fakePool";

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../skills");

// OpenAI-compatible response with a final message and no tool calls
function mockLLM(): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "Base gas is about 0.01 gwei." } }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
}

const env = {
  llmBaseUrl: "http://llm.test/v1",
  llmApiKey: "k",
  llmModel: "m",
  rpcUrl: "http://rpc.test",
  skillsDir,
};

describe("invokeSkillRun", () => {
  it("loads persona + skill, records a run, returns the output", async () => {
    let finished = false;
    const pool = fakePool((text) => {
      if (text.includes("SELECT persona")) {
        return { rowCount: 1, rows: [{ persona: { displayName: "Gas Watcher", bio: "watches gas" } }] };
      }
      if (text.includes("INSERT INTO runs")) return { rowCount: 1, rows: [{ id: 7 }] };
      if (text.includes("UPDATE runs")) {
        finished = true;
        return { rowCount: 1, rows: [] };
      }
      return undefined;
    });

    const r = await invokeSkillRun({
      pool,
      handle: "gas",
      skillSlug: "base-gas-check",
      input: "",
      source: "scheduled",
      env,
      fetchFn: mockLLM(),
    });

    expect(r.status).toBe("ok");
    expect(r.runId).toBe("7");
    expect(r.output).toContain("gwei");
    expect(finished).toBe(true);
    const insert = pool.calls.find((c) => c.text.includes("INSERT INTO runs"))!;
    expect(insert.values![3]).toBe("scheduled");
  });

  it("reads memory before the run and writes an auto note after a successful run", async () => {
    const pool = fakePool((text) => {
      if (text.includes("SELECT persona")) return { rowCount: 1, rows: [{ persona: { displayName: "Gas Watcher" } }] };
      if (text.includes("kind = 'pinned'")) return { rowCount: 1, rows: [{ content: "watch ETH" }] };
      if (text.includes("INSERT INTO runs")) return { rowCount: 1, rows: [{ id: 7 }] };
      return undefined;
    });
    await invokeSkillRun({ pool, handle: "gas", skillSlug: "base-gas-check", input: "", source: "manual", env, fetchFn: mockLLM() });
    expect(pool.calls.some((c) => c.text.includes("kind = 'pinned'"))).toBe(true);
    const ins = pool.calls.find((c) => c.text.includes("INSERT INTO memories"));
    expect(ins).toBeTruthy();
    expect(String(ins!.values![1]).startsWith("base-gas-check: ")).toBe(true);
  });

  it("returns agent_not_found when the agent is missing", async () => {
    const pool = fakePool((text) =>
      text.includes("SELECT persona") ? { rowCount: 0, rows: [] } : undefined,
    );
    const r = await invokeSkillRun({
      pool,
      handle: "ghost",
      skillSlug: "base-gas-check",
      input: "",
      source: "manual",
      env,
      fetchFn: mockLLM(),
    });
    expect(r.invokeError).toBe("agent_not_found");
  });

  it("returns unknown_skill for a slug not in the catalog", async () => {
    const pool = fakePool((text) =>
      text.includes("SELECT persona")
        ? { rowCount: 1, rows: [{ persona: { displayName: "X" } }] }
        : undefined,
    );
    const r = await invokeSkillRun({
      pool,
      handle: "gas",
      skillSlug: "does-not-exist",
      input: "",
      source: "manual",
      env,
      fetchFn: mockLLM(),
    });
    expect(r.invokeError).toBe("unknown_skill");
  });
});
