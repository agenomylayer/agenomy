import type { AgentSummary } from "@aeonomy/shared";

export interface GalleryFilter {
  skill?: string;
  sort?: "recent";
}

export function filterAndSortAgents(
  agents: AgentSummary[],
  filter: GalleryFilter,
): AgentSummary[] {
  let out = agents;
  if (filter.skill) {
    out = out.filter((a) => a.skills.includes(filter.skill as string));
  }
  // default + "recent" both mean createdAt desc
  return [...out].sort((x, y) => y.createdAt - x.createdAt);
}
