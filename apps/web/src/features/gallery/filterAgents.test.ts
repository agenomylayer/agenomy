import { describe, it, expect } from "vitest";
import { filterAndSortAgents } from "./filterAgents";
import type { AgentSummary } from "@agenomy/shared";

const a: AgentSummary = {
  agentId: 1,
  handle: "alpha",
  owner: "0xaa",
  wallet: "0xbb",
  skills: ["web-search"],
  createdAt: 100,
};
const b: AgentSummary = {
  agentId: 2,
  handle: "beta",
  owner: "0xaa",
  wallet: "0xcc",
  skills: ["arxiv"],
  createdAt: 300,
};
const c: AgentSummary = {
  agentId: 3,
  handle: "gamma",
  owner: "0xaa",
  wallet: "0xdd",
  skills: ["web-search", "arxiv"],
  createdAt: 200,
};

describe("filterAndSortAgents", () => {
  it("filters by skill", () => {
    const out = filterAndSortAgents([a, b, c], { skill: "arxiv" });
    expect(out.map((x) => x.handle)).toEqual(["beta", "gamma"]);
  });

  it("sorts by recent (createdAt desc) by default", () => {
    const out = filterAndSortAgents([a, b, c], {});
    expect(out.map((x) => x.handle)).toEqual(["beta", "gamma", "alpha"]);
  });

  it("returns all when no skill filter", () => {
    const out = filterAndSortAgents([a, b, c], { skill: "" });
    expect(out).toHaveLength(3);
  });
});
