"use client";

import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { AvatarBlob } from "../../../src/components/AvatarBlob";
import { shortAddress } from "../../../src/components/format";

const ICONS: Record<string, React.ReactNode> = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  run: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg>
  ),
  schedules: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
  ),
  earnings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.2 9.4a2.5 2.5 0 0 1 2.8-1.4c1.6.2 2.4 1.3 2.2 2.4c-.3 1.6-3.6 1.3-3.9 3c-.2 1.1.7 2.2 2.3 2.4a2.5 2.5 0 0 0 2.8-1.4" /></svg>
  ),
  memory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z" /><path d="M10 9.5h4M10 13h4" /></svg>
  ),
};

const NAV: Array<{ id: string; label: string; tag?: string }> = [
  { id: "overview", label: "Overview" },
  { id: "run", label: "Run" },
  { id: "schedules", label: "Schedules" },
  { id: "earnings", label: "Earnings" },
  { id: "memory", label: "Memory" },
];

export function AgentRail({
  handle,
  displayName,
  avatarSeed,
}: {
  handle: string;
  displayName: string;
  avatarSeed: string;
}) {
  const [active, setActive] = useState("overview");
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  return (
    <aside className="ac-rail">
      <div className="ac-railagent">
        <span className="ac-railavatar">
          <AvatarBlob seed={avatarSeed} size={38} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{displayName}</div>
          <div className="hd">{handle}</div>
        </div>
      </div>

      <nav className="ac-nav">
        <div className="ac-navlabel">Agent</div>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={active === n.id ? "ac-navitem on" : "ac-navitem"}
            onClick={() => setActive(n.id)}
          >
            {ICONS[n.id]}
            {n.label}
            {n.tag && <span className="nt">{n.tag}</span>}
          </a>
        ))}
      </nav>

      <div className="ac-railwallet">
        {isConnected && address ? (
          <>
            <span className="ac-dotok" aria-hidden="true" />
            <span className="addr mono">{shortAddress(address)}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => disconnect()}>disconnect</button>
          </>
        ) : (
          <button
            className="btn btn-primary btn-xs"
            style={{ width: "100%" }}
            disabled={!openConnectModal}
            onClick={() => openConnectModal?.()}
          >
            Connect wallet
          </button>
        )}
      </div>

      <div className="ac-railfoot">
        <span className="ac-dotok" aria-hidden="true" />
        Identity on Base + Solana · live on Base Sepolia
      </div>
    </aside>
  );
}
