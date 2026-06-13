import type {
  Skill,
  AgentSummary,
  AgentDetail,
  Manifest,
} from "@agenomy/shared";
import type { Address } from "viem";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchSkills(params?: {
  category?: string;
  q?: string;
}): Promise<Skill[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const data = await getJson<{ skills: Skill[] }>(`/api/skills${suffix}`);
  return data.skills;
}

export async function fetchAgents(params?: {
  skill?: string;
  category?: string;
  sort?: "recent";
  limit?: number;
  offset?: number;
}): Promise<{ agents: AgentSummary[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.skill) qs.set("skill", params.skill);
  if (params?.category) qs.set("category", params.category);
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return getJson<{ agents: AgentSummary[]; total: number }>(
    `/api/agents${suffix}`,
  );
}

export async function fetchAgent(handle: string): Promise<AgentDetail | null> {
  const res = await fetch(`/api/agents/${encodeURIComponent(handle)}`, {
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/agents/${handle} -> ${res.status}`);
  const data = (await res.json()) as { agent: AgentDetail };
  return data.agent;
}

export interface HandleAvailability {
  available: boolean;
  reason?: string;
}

export async function fetchHandleAvailable(
  handle: string,
): Promise<HandleAvailability> {
  return getJson<HandleAvailability>(
    `/api/agents/handle-available?handle=${encodeURIComponent(handle)}`,
  );
}

export async function pinManifest(
  manifest: Manifest,
): Promise<{ cid: string; manifestHash: Address }> {
  const res = await fetch("/api/manifests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest }),
  });
  if (!res.ok) throw new Error(`POST /api/manifests -> ${res.status}`);
  return (await res.json()) as { cid: string; manifestHash: Address };
}
