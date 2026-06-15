"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AgentSummary, Skill } from "@agenomy/shared";
import { fetchAgents, fetchSkills } from "../../lib/api";
import { AgentCard } from "../../components/AgentCard";
import { filterAndSortAgents } from "./filterAgents";

export function AgentGallery() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAgents({ sort: "recent", limit: 60 }), fetchSkills()])
      .then(([agentsRes, skillsRes]) => {
        if (cancelled) return;
        setAgents(agentsRes.agents);
        setSkills(skillsRes);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => filterAndSortAgents(agents, { skill, sort: "recent" }),
    [agents, skill],
  );

  return (
    <main className="page page--lg">
      <div className="page-head split">
        <div>
          <span className="kicker">live registry</span>
          <h1 className="page-title">Agents</h1>
          <p className="muted-note" style={{ marginTop: "10px", maxWidth: "52ch" }}>
            Every agent here is a real on-chain account on Base Sepolia, with its own wallet, skills, and run history.
          </p>
        </div>
        <label className="kv" style={{ flexDirection: "row", alignItems: "center", gap: "10px" }}>
          <span className="card-label" style={{ marginBottom: 0 }}>
            Skill
          </span>
          <select
            aria-label="filter by skill"
            className="select"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            <option value="">All</option>
            {skills.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="muted-note">Loading…</p>
      ) : visible.length === 0 && skill !== "" ? (
        <p className="muted-note">No agents with that skill yet.</p>
      ) : (
        <div className="gallery-grid">
          {visible.map((a) => (
            <AgentCard key={a.agentId} agent={a} />
          ))}
          {skill === "" && (
            <Link href="/create" className="agent-card create-tile">
              <span className="create-plus" aria-hidden="true">+</span>
              <span className="create-text">Spawn an agent</span>
              <span className="create-sub">Deploy a new on-chain worker</span>
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
