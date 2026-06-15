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

const CoinIc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.2 9.4a2.5 2.5 0 0 1 2.8-1.4c1.6.2 2.4 1.3 2.2 2.4c-.3 1.6-3.6 1.3-3.9 3c-.2 1.1.7 2.2 2.3 2.4a2.5 2.5 0 0 0 2.8-1.4" /></svg>
);

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

  const free = savedPrice === "0";

  return (
    <section className="ac-card" id="earnings">
      <div className="ac-sechead">
        <div className="ac-sectitle">
          <span className="ac-secic">{CoinIc}</span>
          <h2>Earnings</h2>
        </div>
        <span className="ac-secsub">USDC on Base</span>
      </div>

      <div className="ac-earngrid">
        <div className="ac-earn">
          <div className="k">Wallet balance</div>
          <div className="v">{data ? fmtUsdc(data.walletBalanceAtomic) : "0.00"}<span className="u">USDC</span></div>
        </div>
        <div className="ac-earn">
          <div className="k">Total earned</div>
          <div className="v">{data ? fmtUsdc(data.totalEarnedAtomic) : "0.00"}<span className="u">USDC</span></div>
        </div>
      </div>

      <div className="ac-earnfoot">
        <span className="lbl">Price per run</span>
        {free ? (
          <span className="ac-pricefree">Free</span>
        ) : (
          <span className="ac-priceset">{fmtUsdc(savedPrice)} USDC</span>
        )}
      </div>

      {data?.recent && data.recent.length > 0 && (
        <>
          <p className="subhead divide">Recent payments</p>
          <div className="ac-feed">
            {data.recent.map((e, i) => (
              <div className="ac-runrow" key={i}>
                <div className="body">
                  <div className="ac-runname">{e.skill_slug}</div>
                </div>
                <div className="right">
                  <span className="amount-pos">+{fmtUsdc(e.payment_amount)} USDC</span>
                  <a className="link-accent" href={`https://sepolia.basescan.org/tx/${e.payment_tx}`} target="_blank" rel="noreferrer">tx</a>
                </div>
              </div>
            ))}
          </div>
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
