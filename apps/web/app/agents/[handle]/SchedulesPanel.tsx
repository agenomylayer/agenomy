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
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const ClockIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
);

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

  return (
    <section className="ac-card" id="schedules">
      <div className="ac-sechead">
        <div className="ac-sectitle">
          <span className="ac-secic">{ClockIc}</span>
          <h2>Schedules</h2>
        </div>
        <span className="ac-secsub">UTC</span>
      </div>

      <div className="form-col">
        <select className="field" value={skill} onChange={(e) => setSkill(e.target.value)}>
          {skills.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="field"
          placeholder="input reused each run (leave blank if none)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="ac-cadence">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={cron === p.cron ? "ac-cad on" : "ac-cad"}
              onClick={() => setCron(p.cron)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="field mono"
          placeholder="custom cron, e.g. 0 9 * * 1"
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !skill} onClick={create} style={{ alignSelf: "flex-start" }}>
          {busy ? "Saving…" : "Add schedule"}
        </button>
        {err && <p className="form-err">{err}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <p className="subhead divide">Active schedules</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {rows.map((r) => (
              <div className="ac-schedrow" key={r.id}>
                <span className={r.enabled ? "sd on" : "sd off"} aria-hidden="true" />
                <div className="body">
                  <div className="ac-schedname">{r.skill_slug}</div>
                  <div className="ac-schedcad">
                    {cadence(r.cron)} · next {fmt(r.next_run_at)}
                  </div>
                </div>
                <div className="right">
                  <button className="btn btn-ghost btn-xs" onClick={() => toggle(r)}>
                    {r.enabled ? "pause" : "resume"}
                  </button>
                  <button className="btn btn-ghost btn-xs" onClick={() => remove(r)}>
                    delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
