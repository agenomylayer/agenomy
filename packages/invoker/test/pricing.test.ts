import { describe, it, expect } from "vitest";
import { getPrice, setPrice, recordPayment, earningsSummary } from "../src/pricing";
import { fakePool } from "./fakePool";

describe("pricing + earnings helpers", () => {
  it("getPrice returns 0 when no row", async () => {
    const pool = fakePool(() => ({ rowCount: 0, rows: [] }));
    expect(await getPrice(pool, "gas")).toBe(0n);
  });

  it("getPrice returns the stored atomic price as bigint", async () => {
    const pool = fakePool((t) => (t.includes("FROM pricing") ? { rowCount: 1, rows: [{ price_atomic: "10000" }] } : undefined));
    expect(await getPrice(pool, "gas")).toBe(10000n);
  });

  it("setPrice upserts the atomic price", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await setPrice(pool, "gas", 10000n);
    expect(pool.calls[0].text).toMatch(/INSERT INTO pricing[\s\S]*ON CONFLICT/i);
    expect(pool.calls[0].values).toEqual(["gas", "10000"]);
  });

  it("recordPayment sets the run's payment columns", async () => {
    const pool = fakePool(() => ({ rowCount: 1, rows: [] }));
    await recordPayment(pool, "7", { amount: 10000n, payer: "0xabc", tx: "0xdead" });
    expect(pool.calls[0].text).toMatch(/UPDATE runs SET payment_amount/i);
    expect(pool.calls[0].values).toEqual(["7", "10000", "0xabc", "0xdead"]);
  });

  it("earningsSummary sums paid runs and lists recent", async () => {
    const pool = fakePool((t) => {
      if (t.includes("SUM")) return { rowCount: 1, rows: [{ total: "30000" }] };
      if (t.includes("ORDER BY")) return { rowCount: 1, rows: [{ skill_slug: "base-gas-check", payment_amount: "10000", payer: "0xabc", payment_tx: "0xd", started_at: "t" }] };
      return undefined;
    });
    const s = await earningsSummary(pool, "gas");
    expect(s.totalAtomic).toBe(30000n);
    expect(s.recent[0].skill_slug).toBe("base-gas-check");
  });
});
