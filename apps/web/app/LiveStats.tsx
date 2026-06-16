"use client";

import { useEffect, useState } from "react";

interface Stats { agents: number; runs: number; skills: number }

export function LiveStats() {
  const [d, setD] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setD).catch(() => {});
  }, []);
  const num = (v: number | undefined) => (v == null ? "—" : v.toLocaleString());
  return (
    <div className="stats">
      <div className="stat">
        <div className="n">{num(d?.agents)}</div>
        <div className="l">agents spawned</div>
      </div>
      <div className="stat">
        <div className="n">{num(d?.runs)}</div>
        <div className="l">runs executed</div>
      </div>
      <div className="stat">
        <div className="n">{num(d?.skills)}</div>
        <div className="l">skills available</div>
      </div>
      <div className="stat">
        <div className="n">x402</div>
        <div className="l">USDC payment rail</div>
      </div>
    </div>
  );
}
