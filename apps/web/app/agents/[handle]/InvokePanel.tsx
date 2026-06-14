"use client";

import { useEffect, useState } from "react";

interface SkillItem {
  slug: string;
  name: string;
  category: string;
  inputs: string;
  tools: string[];
}
interface RunRow {
  id: string;
  skill_slug: string;
  input: string;
  status: string;
  output: string | null;
  source?: string;
  started_at: string;
}
interface RunResult {
  status: string;
  output: string;
  trace?: unknown[];
  error?: string;
}

export function InvokePanel({ handle }: { handle: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skill, setSkill] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);

  function loadRuns() {
    fetch(`/api/agents/${handle}/runs`)
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    fetch("/api/skills/catalog")
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.skills ?? []);
        if (d.skills?.[0]) setSkill(d.skills[0].slug);
      })
      .catch(() => {});
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!skill) return;
    setRunning(true);
    setResult(null);
    setShowTrace(false);
    try {
      const res = await fetch(`/api/agents/${handle}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillSlug: skill, input }),
      });
      setResult((await res.json()) as RunResult);
      loadRuns();
    } catch {
      setResult({ status: "error", output: "", error: "request failed" });
    } finally {
      setRunning(false);
    }
  }

  const current = skills.find((s) => s.slug === skill);

  return (
    <section className="card">
      <h2 className="card-label">Run a skill</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <select className="field" value={skill} onChange={(e) => setSkill(e.target.value)}>
          {skills.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} ({s.category})
            </option>
          ))}
        </select>
        {current && (
          <p className="muted-note" style={{ margin: 0 }}>
            Input: {current.inputs}
          </p>
        )}
        <input
          className="field"
          placeholder="input (if the skill needs one)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="btn btn-primary"
          disabled={running || !skill}
          onClick={run}
          style={{ alignSelf: "flex-start" }}
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      {result && (
        <div className="card" style={{ marginTop: "14px", background: "var(--panel-2)" }}>
          <p style={{ margin: 0, fontSize: "14.5px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {result.status === "ok" ? result.output : `error: ${result.error ?? "run failed"}`}
          </p>
          {result.trace && result.trace.length > 0 && (
            <>
              <button
                className="btn btn-ghost"
                style={{ marginTop: "10px", fontSize: "13px" }}
                onClick={() => setShowTrace(!showTrace)}
              >
                {showTrace ? "hide" : "show"} trace ({result.trace.length})
              </button>
              {showTrace && (
                <pre
                  className="mono"
                  style={{ marginTop: "8px", fontSize: "12px", overflowX: "auto", whiteSpace: "pre-wrap" }}
                >
                  {JSON.stringify(result.trace, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h3 className="card-label" style={{ fontSize: "12px" }}>
            Recent runs
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {runs.map((r) => (
              <li key={r.id} style={{ fontSize: "13.5px", borderTop: "1px solid var(--line)", paddingTop: "8px" }}>
                <span className="mono" style={{ color: "var(--ink-mute)" }}>
                  {r.skill_slug}
                </span>{" "}
                <span style={{ color: r.status === "ok" ? "var(--green)" : "var(--accent)" }}>{r.status}</span>
                {r.source === "scheduled" && (
                  <span className="muted-note" style={{ marginLeft: "6px", fontSize: "11px" }}>
                    · scheduled
                  </span>
                )}
                {r.output && (
                  <div style={{ color: "var(--ink-soft)", marginTop: "2px" }}>{r.output}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
