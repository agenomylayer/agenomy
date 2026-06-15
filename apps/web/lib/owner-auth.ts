import { verifyMessage } from "viem";

const MAX_AGE_SECONDS = 600; // 10 minutes

export function priceMessage(handle: string, priceAtomic: bigint, ts: number): string {
  return `Agenomy: set price for ${handle} to ${priceAtomic.toString()} (USDC atomic) at ${ts}`;
}

export async function verifyOwnerSig(opts: {
  handle: string;
  priceAtomic: bigint;
  ts: number;
  signature: `0x${string}`;
  owner: string;
  now: number; // unix seconds (injectable for tests)
}): Promise<boolean> {
  if (!Number.isFinite(opts.ts)) return false;
  if (Math.abs(opts.now - opts.ts) > MAX_AGE_SECONDS) return false;
  const message = priceMessage(opts.handle, opts.priceAtomic, opts.ts);
  try {
    return await verifyMessage({ address: opts.owner as `0x${string}`, message, signature: opts.signature });
  } catch {
    return false;
  }
}
