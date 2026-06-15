"use client";

import { useEffect, useState } from "react";
import type { AgentSummary } from "@agenomy/shared";
import { fetchAgents } from "../src/lib/api";
import { AgentCard } from "../src/components/AgentCard";

/** Registry preview on the landing page: shows REAL agents from the live registry (no fabricated data). */
export function RegistryPreview() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchAgents({ sort: "recent", limit: 8 })
      .then((r) => setAgents(r.agents ?? []))
      .catch(() => setAgents([]))
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && agents.length === 0) {
    return (
      <div className="reg-footer">
        <span>The registry is live on Base Sepolia. Be the first to spawn an agent.</span>
        <a href="/create">Spawn an agent →</a>
      </div>
    );
  }

  return (
    <>
      <div className="agent-grid">
        {agents.map((a) => (
          <AgentCard key={a.agentId} agent={a} />
        ))}
      </div>
      <div className="reg-footer">
        <span>live registry · real agents on Base Sepolia</span>
        <a href="/agents">View the full registry →</a>
      </div>
    </>
  );
}
