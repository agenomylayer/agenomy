"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

const USDC_DECIMALS = 6;
const fmtUsdc = (atomic: string) =>
  (Number(atomic) / 10 ** USDC_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 6 });
const toAtomic = (usdc: string) => BigInt(Math.round(Number(usdc) * 10 ** USDC_DECIMALS));

interface Earnings {
  wallet: string;
  walletBalanceAtomic: string;
  totalEarnedAtomic: string;
  recent: Array<{ skill_slug: string; payment_amount: string; payer: string; payment_tx: string; started_at: string }>;
}

export function EarningsPanel({ handle, owner }: { handle: string; owner: string }) {
  const [data, setData] = useState<Earnings | null>(null);
  const [price, setPrice] = useState("");
  const [savedPrice, setSavedPrice] = useState<string>("0");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const isOwner = Boolean(address && address.toLowerCase() === owner.toLowerCase());

  function load() {
    fetch(`/api/agents/${handle}/earnings`).then((r) => r.json()).then(setData).catch(() => {});
    fetch(`/api/agents/${handle}/pricing`).then((r) => r.json()).then((d) => setSavedPrice(d.priceAtomic ?? "0")).catch(() => {});
  }
  useEffect(load, [handle]);

  async function savePrice() {
    setBusy(true);
    setMsg("");
    try {
      const priceAtomic = toAtomic(price || "0");
      const ts = Math.floor(Date.now() / 1000);
      const message = `Agenomy: set price for ${handle} to ${priceAtomic.toString()} (USDC atomic) at ${ts}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch(`/api/agents/${handle}/pricing`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceAtomic: priceAtomic.toString(), ts, signature }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error ?? "could not set price");
      } else {
        setMsg("price updated");
        load();
      }
    } catch {
      setMsg("signature cancelled");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-label">Earnings</h2>
      {data && (
        <dl className="kv">
          <div><span className="k">Wallet balance </span><span className="v mono">{fmtUsdc(data.walletBalanceAtomic)} USDC</span></div>
          <div><span className="k">Total earned </span><span className="v mono">{fmtUsdc(data.totalEarnedAtomic)} USDC</span></div>
          <div><span className="k">Price / run </span><span className="v mono">{fmtUsdc(savedPrice)} USDC{savedPrice === "0" ? " (free)" : ""}</span></div>
        </dl>
      )}

      {data?.recent && data.recent.length > 0 && (
        <>
          <p className="subhead divide">Recent payments</p>
          <ul className="feed">
            {data.recent.map((e, i) => (
              <li key={i} className="feed-row">
                <div className="feed-top">
                  <span className="feed-name">{e.skill_slug}</span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    <span className="amount-pos">+{fmtUsdc(e.payment_amount)} USDC</span>{" "}
                    <a className="link-accent" href={`https://sepolia.basescan.org/tx/${e.payment_tx}`} target="_blank" rel="noreferrer">tx</a>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {isOwner && (
        <div className="owner-box">
          <span className="owner-tag">Owner</span>
          <p className="muted-note" style={{ margin: "0 0 10px" }}>Set price per run (USDC, 0 = free). You sign with your owner wallet.</p>
          <div className="form-row">
            <input className="field mono" style={{ maxWidth: "160px" }} placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
            <button className="btn btn-primary" disabled={busy} onClick={savePrice}>{busy ? "Signing…" : "Set price"}</button>
          </div>
          {msg && <p className="muted-note" style={{ margin: "10px 0 0" }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}
