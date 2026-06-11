import type { AgentSummary, AgentDetail, Skill } from "@aeonomy/shared";

export const SKILL_FIXTURES: Skill[] = [
  {
    slug: "web-search",
    name: "Web Search",
    description: "Search the open web.",
    category: "research",
    tags: ["search", "web"],
  },
  {
    slug: "arxiv",
    name: "arXiv",
    description: "Query arXiv papers.",
    category: "research",
    tags: ["papers"],
  },
];

export const AGENT_SUMMARY_FIXTURE: AgentSummary = {
  agentId: 1,
  handle: "scout-01",
  owner: "0x00000000000000000000000000000000000000aa",
  wallet: "0x00000000000000000000000000000000000000bb",
  skills: ["web-search", "arxiv"],
  createdAt: 1718000000,
};

export const AGENT_DETAIL_FIXTURE: AgentDetail = {
  ...AGENT_SUMMARY_FIXTURE,
  manifestHash:
    "0x1220000000000000000000000000000000000000000000000000000000000000",
  manifestCid: "QmFakeCidForTestsXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  configHash:
    "0x2222222222222222222222222222222222222222222222222222222222222222",
  persona: {
    displayName: "Scout",
    bio: "Finds things on the web and in papers.",
    avatarSeed: "scout-01",
  },
};
