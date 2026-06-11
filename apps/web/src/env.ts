import type { Address } from "viem";

export interface ClientEnv {
  registryAddress: Address;
  walletConnectId: string;
}

interface RawClientEnv {
  NEXT_PUBLIC_REGISTRY_ADDRESS?: string;
  NEXT_PUBLIC_WALLETCONNECT_ID?: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function readClientEnv(raw: RawClientEnv): ClientEnv {
  const addr = raw.NEXT_PUBLIC_REGISTRY_ADDRESS;
  if (!addr || !ADDRESS_RE.test(addr)) {
    throw new Error(
      `NEXT_PUBLIC_REGISTRY_ADDRESS missing or malformed: ${String(addr)}`,
    );
  }
  const wc = raw.NEXT_PUBLIC_WALLETCONNECT_ID;
  if (!wc) {
    throw new Error("NEXT_PUBLIC_WALLETCONNECT_ID missing");
  }
  return { registryAddress: addr as Address, walletConnectId: wc };
}

/**
 * Lazily-validated client env. Importing this module must NEVER throw (so unit
 * tests and tooling that only need `readClientEnv` can load it without
 * NEXT_PUBLIC_* set). Validation runs on first field access at runtime, where
 * the public env vars are expected to be present.
 */
let cachedEnv: ClientEnv | undefined;
function resolveClientEnv(): ClientEnv {
  if (!cachedEnv) {
    cachedEnv = readClientEnv({
      NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
      NEXT_PUBLIC_WALLETCONNECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
    });
  }
  return cachedEnv;
}

export const clientEnv: ClientEnv = {
  get registryAddress(): Address {
    return resolveClientEnv().registryAddress;
  },
  get walletConnectId(): string {
    return resolveClientEnv().walletConnectId;
  },
};
