"use client";

import { useEffect, useState } from "react";

interface SkillItem {
  slug: string;
  name: string;
  category: string;
  inputs: string;
}
interface ScheduleRow {
  id: string;
  skill_slug: string;
  input: string;
  cron: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
}

const PRESETS: Array<{ key: string; label: string; cron: string }> = [
  { key: "hourly", label: "Hourly", cron: "0 * * * *" },
  { key: "every_6h", label: "Every 6h", cron: "0 */6 * * *" },
  { key: "daily", label: "Daily 09:00", cron: "0 9 * * *" },
  { key: "weekly", label: "Weekly Mon", cron: "0 9 * * 1" },
];
const PRESET_LABELS: Record<string, string> = {
  "0 * * * *": "Hourly",
  "0 */6 * * *": "Every 6 hours",
  "0 9 * * *": "Daily 09:00 UTC",
  "0 9 * * 1": "Weekly (Mon 09:00 UTC)",
};
const cadence = (cron: string) => PRESET_LABELS[cron] ?? cron;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export function SchedulesPanel({ handle }: { handle: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [skill, setSkill] = useState("");
  const [input, setInput] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function load() {
    fetch(`/api/agents/${handle}/schedules`)
      .then((r) => r.json())
      .then((d) => setRows(d.schedules ?? []))
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/agents/${handle}/schedules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillSlug: skill, input, cron }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error ?? "could not create schedule");
      } else {
        setInput("");
        load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: ScheduleRow) {
    await fetch(`/api/agents/${handle}/schedules/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    load();
  }

  async function remove(r: ScheduleRow) {
    await fetch(`/api/agents/${handle}/schedules/${r.id}`, { method: "DELETE" });
    load();
  }

  const current = skills.find((s) => s.slug === skill);

  return (
    <section className="card">
      <h2 className="card-label">Schedules</h2>
      <p className="muted-note" style={{ marginTop: 0 }}>
        Runs this agent automatically. Times are UTC. Input is stored once and reused each run.
      </p>

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
          placeholder="input reused each run (leave blank if none)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={cron === p.cron ? "btn btn-primary" : "btn btn-ghost"}
              style={{ fontSize: "13px" }}
              onClick={() => setCron(p.cron)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="field mono"
          placeholder="custom cron (UTC), e.g. 0 9 * * 1"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !skill} onClick={create} style={{ alignSelf: "flex-start" }}>
          {busy ? "Saving…" : "Add schedule"}
        </button>
        {err && <p style={{ color: "var(--accent)", margin: 0, fontSize: "13.5px" }}>{err}</p>}
      </div>

      {rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", fontSize: "13.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <span className="mono">{r.skill_slug}</span>
                <span className="muted-note">{cadence(r.cron)}</span>
              </div>
              {r.input && <div style={{ color: "var(--ink-soft)" }}>input: {r.input}</div>}
              <div className="muted-note">
                next: {fmt(r.next_run_at)} · last: {fmt(r.last_run_at)} · {r.enabled ? "enabled" : "paused"}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={() => toggle(r)}>
                  {r.enabled ? "pause" : "resume"}
                </button>
                <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={() => remove(r)}>
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
