import { describe, it, expect } from "vitest";
import { onchainRead } from "../src/tools/onchain";

const fakeClient = {
  getBalance: async () => 1000000000000000000n, // 1 ETH
  getGasPrice: async () => 1500000000n,
  readContract: async ({ functionName }: { functionName: string }) =>
    functionName === "symbol" ? "USDC" : functionName === "decimals" ? 6 : 0n,
};
const ctx = { rpcUrl: "x", fetch, makeClient: () => fakeClient } as any;

describe("onchain_read", () => {
  it("reports an ETH balance as a decimal string", async () => {
    const r = await onchainRead.run(
      { action: "balance", address: "0x0000000000000000000000000000000000000001" },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect((r.data as any).eth).toBe("1");
  });
  it("reports gas price in gwei", async () => {
    const r = await onchainRead.run({ action: "gasPrice" }, ctx);
    expect(r.ok).toBe(true);
    expect((r.data as any).gwei).toBe(1.5);
  });
  it("rejects a malformed address", async () => {
    const r = await onchainRead.run({ action: "balance", address: "nope" }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/address/i);
  });
});
