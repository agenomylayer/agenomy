"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { shortAddress } from "../../components/format";

/**
 * Wallet connect control. Opens RainbowKit's wallet picker modal (MetaMask,
 * Coinbase, WalletConnect QR, etc.) via useConnectModal, wrapped in our own
 * warm-stone .btn so the page keeps the design system. More robust than
 * connecting blindly to connectors[0].
 */
export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal, connectModalOpen } = useConnectModal();

  if (isConnected && address) {
    return (
      <div className="wallet-connect">
        <span className="pill">
          <span className="dot" />
          <b className="mono">{shortAddress(address)}</b>
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        type="button"
        className="btn btn-primary"
        disabled={!openConnectModal || connectModalOpen}
        onClick={() => openConnectModal?.()}
      >
        {connectModalOpen ? "Connecting…" : "Connect Wallet"}
      </button>
    </div>
  );
}
