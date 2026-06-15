import { describe, it, expect } from "vitest";
import { readUsdcBalanceAtomic } from "../lib/usdc";

describe("readUsdcBalanceAtomic", () => {
  it("reads balanceOf via the injected client and returns a bigint", async () => {
    const fakeClient = { readContract: async () => 42000n };
    const bal = await readUsdcBalanceAtomic("0x000000000000000000000000000000000000bEEF", "http://rpc", fakeClient);
    expect(bal).toBe(42000n);
  });
});
