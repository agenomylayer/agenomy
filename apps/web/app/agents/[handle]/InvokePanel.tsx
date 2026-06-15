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

export function InvokePanel({ handle }: { handle: string }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skill, setSkill] = useState("");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
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

  const current = skills.find((s) => s.slug === skill);

  return (
    <section className="card">
      <h2 className="card-label">Run a skill</h2>
      <div className="form-col">
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
        {price !== "0" && (
          <p className="muted-note" style={{ margin: 0 }}>
            Price: {(Number(price) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} USDC per run
            {!walletClient ? " — connect your wallet to pay" : ""}
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={running || !skill || (price !== "0" && !walletClient)}
          onClick={run}
          style={{ alignSelf: "flex-start" }}
        >
          {running ? "Running…" : price !== "0" ? "Pay & Run" : "Run"}
        </button>
      </div>

      {result && (
        <div className="result">
          <div className="result-top">
            <span className="subhead" style={{ margin: 0 }}>Result</span>
            <span className={result.status === "ok" ? "tag tag-ok" : "tag tag-err"}>{result.status}</span>
          </div>
          <p className="result-out">
            {result.status === "ok" ? result.output : `error: ${result.error ?? "run failed"}`}
          </p>
          {result.trace && result.trace.length > 0 && (
            <>
              <button
                className="btn btn-ghost btn-xs"
                style={{ marginTop: "10px" }}
                onClick={() => setShowTrace(!showTrace)}
              >
                {showTrace ? "hide" : "show"} trace ({result.trace.length})
              </button>
              {showTrace && <pre className="result-trace">{JSON.stringify(result.trace, null, 2)}</pre>}
            </>
          )}
        </div>
      )}

      {runs.length > 0 && (
        <div>
          <p className="subhead divide">Recent runs</p>
          <ul className="feed">
            {runs.map((r) => (
              <li key={r.id} className="feed-row">
                <div className="feed-top">
                  <span className="feed-name">{r.skill_slug}</span>
                  <span className={r.status === "ok" ? "tag tag-ok" : "tag tag-err"}>
                    {r.status}
                    {r.source === "scheduled" ? " · scheduled" : ""}
                  </span>
                </div>
                {r.output && <div className="feed-sub">{r.output}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
