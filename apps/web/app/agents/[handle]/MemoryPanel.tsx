"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

interface Entry { id: string; kind: "auto" | "pinned"; content: string; content_hash: string; created_at: string; }
interface Snapshot { cid: string; hash: string; entry_count: number; updated_at: string; }

const ChipIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z" /><path d="M10 9.5h4M10 13h4" /></svg>
);

const fmt = (s: string) => {
  try {
    return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
};

const sha256Hex = async (s: string) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};

export function MemoryPanel({ handle, owner, ipfsGateway }: { handle: string; owner: string; ipfsGateway: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const isOwner = Boolean(address && address.toLowerCase() === owner.toLowerCase());

  function load() {
    fetch(`/api/agents/${handle}/memory`)
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries ?? []); setSnapshot(d.snapshot ?? null); })
      .catch(() => {});
  }
  useEffect(load, [handle]);

  async function pin() {
    const content = note.trim();
    if (!content) return;
    setBusy(true);
    setMsg("");
    try {
      const ts = Math.floor(Date.now() / 1000);
      const hash = await sha256Hex(content);
      const signature = await signMessageAsync({ message: `Agenomy: pin memory for ${handle} :: ${hash} :: ${ts}` });
      const res = await fetch(`/api/agents/${handle}/memory`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, ts, signature }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d.error ?? "could not pin"); }
      else { setNote(""); load(); }
    } catch {
      setMsg("signature cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setMsg("");
    try {
      const ts = Math.floor(Date.now() / 1000);
      const signature = await signMessageAsync({ message: `Agenomy: delete memory ${id} for ${handle} at ${ts}` });
      const res = await fetch(`/api/agents/${handle}/memory/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ts, signature }),
      });
      if (res.ok) load();
      else setMsg("could not delete");
    } catch {
      setMsg("signature cancelled");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ac-card" id="memory">
      <div className="ac-sechead">
        <div className="ac-sectitle">
          <span className="ac-secic">{ChipIc}</span>
          <h2>Memory</h2>
        </div>
        <span className="ac-secsub">{entries.length} {entries.length === 1 ? "entry" : "entries"} · verifiable</span>
      </div>

      {snapshot && (
        <div className="ac-memsnap">
          anchored to IPFS ·{" "}
          <a className="link-accent" href={`https://${ipfsGateway}/ipfs/${snapshot.cid}`} target="_blank" rel="noreferrer">{snapshot.cid.slice(0, 10)}…</a>
          {" "}· {snapshot.entry_count} entries · on-chain attestation comes with mainnet
        </div>
      )}

      {entries.length === 0 ? (
        <p className="muted-note">No memories yet. This agent starts remembering after its first run, and you can pin durable facts below.</p>
      ) : (
        <div className="ac-feed">
          {entries.map((e) => (
            <div className="ac-memrow" key={e.id}>
              <span className={`ac-memkind ${e.kind}`}>{e.kind}</span>
              <div className="body">
                <div className="ac-memtext">{e.content}</div>
                <div className="ac-memtime">{fmt(e.created_at)}</div>
              </div>
              {isOwner && <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => remove(e.id)}>delete</button>}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="owner-box" style={{ marginTop: "18px" }}>
          <span className="owner-tag">Owner</span>
          <p className="muted-note" style={{ margin: "0 0 10px" }}>Pin a durable fact the agent should always know. You sign with your owner wallet.</p>
          <div className="form-col">
            <textarea className="field" style={{ minHeight: "64px", resize: "vertical" }} placeholder="e.g. watch ETH, WETH, USDC; alert if gas > 5 gwei" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            <button className="btn btn-primary" disabled={busy || !note.trim()} onClick={pin} style={{ alignSelf: "flex-start" }}>{busy ? "Signing…" : "Pin to memory"}</button>
          </div>
          {msg && <p className="muted-note" style={{ margin: "10px 0 0" }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}
