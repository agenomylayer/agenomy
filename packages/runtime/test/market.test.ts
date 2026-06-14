import { describe, it, expect } from "vitest";
import { marketData } from "../src/tools/market";

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as any;
}

describe("market_data", () => {
  it("returns a coin price from DeFiLlama", async () => {
    const f = fakeFetch({ coins: { "coingecko:ethereum": { price: 3500, symbol: "ETH" } } });
    const r = await marketData.run({ action: "price", id: "coingecko:ethereum" }, { rpcUrl: "x", fetch: f });
    expect(r.ok).toBe(true);
    expect((r.data as any).price).toBe(3500);
  });
  it("surfaces an upstream error", async () => {
    const r = await marketData.run({ action: "price", id: "x" }, { rpcUrl: "x", fetch: fakeFetch({}, false) });
    expect(r.ok).toBe(false);
  });
});
