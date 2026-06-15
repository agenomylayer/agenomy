"use client";
// Browser x402 payer: wrap fetch so a 402 is auto-paid with the connected wallet (EIP-3009).
// Confirmed against @x402/* v2.15.0. The exact signTypedData forwarding is verified at the live test.
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { createPublicClient, http, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function paidFetch(walletClient: WalletClient): typeof fetch {
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
  const account = walletClient.account!;
  // x402's ClientEvmSigner needs { address, signTypedData }; forward signing to the connected wallet.
  const signerInput = {
    address: account.address,
    signTypedData: (typedData: any) => walletClient.signTypedData({ account, ...typedData }),
  };
  const signer = toClientEvmSigner(signerInput as any, publicClient as any);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer } as any);
  return wrapFetchWithPayment(fetch, client) as unknown as typeof fetch;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
