"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "../../components/format";

/**
 * Wallet connect control styled with the canonical design system
 * (.btn btn-primary / .btn btn-ghost) instead of RainbowKit's own
 * blue/white themed ConnectButton, so the /create wizard stays on the
 * warm-stone palette like the rest of the app.
 */
export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet-connect">
        <span className="pill">
          <span className="dot" />
          <b className="mono">{shortAddress(address)}</b>
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connector = connectors[0];

  return (
    <div className="wallet-connect">
      <button
        type="button"
        className="btn btn-primary"
        disabled={isPending || !connector}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
