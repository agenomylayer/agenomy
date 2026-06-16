"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { paidFetch } from "../../../lib/x402-client";

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

const Check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Cross = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const RunIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg>
);
const HistIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
);

const fmtTime = (s: string) => {
  try {
    return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
};

export function InvokePanel({ handle }: { handle: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skill, setSkill] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ranSlug, setRanSlug] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [price, setPrice] = useState("0");
  const { data: walletClient } = useWalletClient();

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
    fetch(`/api/agents/${handle}/pricing`)
      .then((r) => r.json())
      .then((d) => setPrice(d.priceAtomic ?? "0"))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    if (!skill) return;
    setRunning(true);
    setResult(null);
    setShowTrace(false);
    setRanSlug(skill);
    try {
      const doFetch = price !== "0" && walletClient ? paidFetch(walletClient) : fetch;
      const res = await doFetch(`/api/agents/${handle}/run`, {
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

  const priced = price !== "0";
  const priceLabel = priced
    ? `${(Number(price) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC per run`
    : "Free while on testnet";

  return (
    <>
      <section className="ac-card" id="run">
        <div className="ac-sechead">
          <div className="ac-sectitle">
            <span className="ac-secic">{RunIc}</span>
            <h2>Run a skill</h2>
          </div>
          <span className="ac-secsub">{priceLabel}</span>
        </div>

        <div className="ac-rungrid">
          <div className="ac-runfield">
            <label>Skill</label>
            <select className="field" value={skill} onChange={(e) => setSkill(e.target.value)}>
              {skills.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ac-runfield">
            <label>Input</label>
            <input
              className="field"
              placeholder="input (if the skill needs one)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <button
            className="btn btn-primary"
            disabled={running || !skill || (priced && !walletClient)}
            onClick={run}
          >
            {running ? "Running…" : priced ? "Pay & Run" : "Run"}
          </button>
        </div>
        {priced && !walletClient && (
          <p className="ac-runnote">Connect your wallet to pay for this run.</p>
        )}

        {result && (
          <div className={result.status === "ok" ? "ac-result" : "ac-result err"}>
            <div className="ac-resultbar">
              <span className={result.status === "ok" ? "tag tag-ok" : "tag tag-err"}>{result.status}</span>
              {ranSlug && <span className="rt">{ranSlug}</span>}
            </div>
            <div className="ac-resultbody">
              <div className="rp">
                {result.status === "ok" ? result.output : `error: ${result.error ?? "run failed"}`}
              </div>
              {result.trace && result.trace.length > 0 && (
                <div className="ac-resultfoot">
                  <button className="ac-tracebtn" onClick={() => setShowTrace(!showTrace)}>
                    {showTrace ? "hide" : "show"} trace ({result.trace.length})
                  </button>
                </div>
              )}
              {showTrace && result.trace && (
                <pre className="ac-tracepre">{JSON.stringify(result.trace, null, 2)}</pre>
              )}
            </div>
          </div>
        )}
      </section>

      {runs.length > 0 && (
        <section className="ac-card" id="runs">
          <div className="ac-sechead">
            <div className="ac-sectitle">
              <span className="ac-secic">{HistIc}</span>
              <h2>Recent runs</h2>
            </div>
            <span className="ac-secsub">last {Math.min(runs.length, 6)}</span>
          </div>
          <div className="ac-feed">
            {runs.slice(0, 6).map((r) => {
              const ok = r.status === "ok";
              return (
                <div className="ac-runrow" key={r.id}>
                  <span className={ok ? "ac-runicon ok" : "ac-runicon err"}>{ok ? Check : Cross}</span>
                  <div className="body">
                    <div className="ac-runname">{r.skill_slug}</div>
                    {r.output && <div className={ok ? "ac-rundetail" : "ac-rundetail err"}>{r.output}</div>}
                  </div>
                  <div className="right">
                    {r.source === "scheduled" && <span className="tag tag-mute">scheduled</span>}
                    <span className={ok ? "tag tag-ok" : "tag tag-err"}>{r.status}</span>
                    <span className="ac-runname" style={{ fontWeight: 400, color: "var(--ink-ghost)" }}>
                      {fmtTime(r.started_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
