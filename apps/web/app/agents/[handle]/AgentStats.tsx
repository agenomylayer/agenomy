"use client";

import { useEffect, useState } from "react";

const fmtUsdc = (atomic: string) =>
  (Number(atomic) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function AgentStats({ handle, skillCount }: { handle: string; skillCount: number }) {
  const [runs, setRuns] = useState<number | null>(null);
  const [earned, setEarned] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/agents/${handle}/runs`).then((r) => r.json()).then((d) => setRuns((d.runs ?? []).length)).catch(() => setRuns(0));
    fetch(`/api/agents/${handle}/earnings`).then((r) => r.json()).then((d) => setEarned(d.totalEarnedAtomic ?? "0")).catch(() => setEarned("0"));
    fetch(`/api/agents/${handle}/schedules`).then((r) => r.json()).then((d) => setSchedules((d.schedules ?? []).length)).catch(() => setSchedules(0));
  }, [handle]);

  return (
    <div className="ac-herostats">
      <div className="ac-stat">
        <div className="k">Runs</div>
        <div className="v">{runs == null ? "—" : runs >= 20 ? "20+" : runs}</div>
      </div>
      <div className="ac-stat">
        <div className="k">Earned</div>
        <div className="v">{earned == null ? "—" : fmtUsdc(earned)}<span className="u">USDC</span></div>
      </div>
      <div className="ac-stat">
        <div className="k">Schedules</div>
        <div className="v">{schedules == null ? "—" : schedules}</div>
      </div>
      <div className="ac-stat">
        <div className="k">Skills</div>
        <div className="v">{skillCount}</div>
      </div>
    </div>
  );
}
