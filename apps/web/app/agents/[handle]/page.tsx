import { notFound } from "next/navigation";
import type { AgentDetail } from "@aeonomy/shared";
import { AgentProfile } from "./AgentProfile";

async function getAgent(handle: string): Promise<AgentDetail | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const res = await fetch(
    `${base}/api/agents/${encodeURIComponent(handle)}`,
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`agent fetch -> ${res.status}`);
  const data = (await res.json()) as { agent: AgentDetail };
  return data.agent;
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const agent = await getAgent(handle);
  if (!agent) notFound();
  const ipfsGateway = process.env.IPFS_GATEWAY ?? "gateway.pinata.cloud";
  return <AgentProfile agent={agent} ipfsGateway={ipfsGateway} />;
}
