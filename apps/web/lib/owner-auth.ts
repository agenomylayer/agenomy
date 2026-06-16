import { verifyMessage } from "viem";

const MAX_AGE_SECONDS = 600; // 10 minutes

export function priceMessage(handle: string, priceAtomic: bigint, ts: number): string {
  return `Agenomy: set price for ${handle} to ${priceAtomic.toString()} (USDC atomic) at ${ts}`;
}
export function memoryPinMessage(handle: string, contentHash: string, ts: number): string {
  return `Agenomy: pin memory for ${handle} :: ${contentHash} :: ${ts}`;
}
export function memoryDeleteMessage(handle: string, id: string, ts: number): string {
  return `Agenomy: delete memory ${id} for ${handle} at ${ts}`;
}

export async function verifyOwnerSignedMessage(opts: {
  message: string;
  signature: `0x${string}`;
  owner: string;
  ts: number;
  now: number;
}): Promise<boolean> {
  if (!Number.isFinite(opts.ts)) return false;
  if (Math.abs(opts.now - opts.ts) > MAX_AGE_SECONDS) return false;
  try {
    return await verifyMessage({ address: opts.owner as `0x${string}`, message: opts.message, signature: opts.signature });
  } catch {
    return false;
  }
}

export async function verifyOwnerSig(opts: {
  handle: string;
  priceAtomic: bigint;
  ts: number;
  signature: `0x${string}`;
  owner: string;
  now: number;
}): Promise<boolean> {
  return verifyOwnerSignedMessage({
    message: priceMessage(opts.handle, opts.priceAtomic, opts.ts),
    signature: opts.signature,
    owner: opts.owner,
    ts: opts.ts,
    now: opts.now,
  });
}
