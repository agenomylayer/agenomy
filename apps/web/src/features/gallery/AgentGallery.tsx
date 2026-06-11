"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentSummary, Skill } from "@aeonomy/shared";
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
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Gallery
      </p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Agents
        </h1>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em]">
            Skill
          </span>
          <select
            aria-label="filter by skill"
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-ink outline-none focus:border-accent"
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
        <p className="text-muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-muted">No agents yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((a) => (
            <AgentCard key={a.agentId} agent={a} />
          ))}
        </div>
      )}
    </main>
  );
}
