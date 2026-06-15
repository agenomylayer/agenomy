import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { priceMessage, verifyOwnerSig } from "../lib/owner-auth";

const acct = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

describe("owner-auth", () => {
  it("accepts a fresh signature from the owner", async () => {
    const ts = 1_750_000_000;
    const msg = priceMessage("gas", 10000n, ts);
    const signature = await acct.signMessage({ message: msg });
    const ok = await verifyOwnerSig({ handle: "gas", priceAtomic: 10000n, ts, signature, owner: acct.address, now: ts + 60 });
    expect(ok).toBe(true);
  });

  it("rejects a signature from a non-owner", async () => {
    const ts = 1_750_000_000;
    const msg = priceMessage("gas", 10000n, ts);
    const signature = await acct.signMessage({ message: msg });
    const ok = await verifyOwnerSig({ handle: "gas", priceAtomic: 10000n, ts, signature, owner: "0x000000000000000000000000000000000000dEaD", now: ts + 60 });
    expect(ok).toBe(false);
  });

  it("rejects a stale signature", async () => {
    const ts = 1_750_000_000;
    const msg = priceMessage("gas", 10000n, ts);
    const signature = await acct.signMessage({ message: msg });
    const ok = await verifyOwnerSig({ handle: "gas", priceAtomic: 10000n, ts, signature, owner: acct.address, now: ts + 4000 });
    expect(ok).toBe(false);
  });
});
