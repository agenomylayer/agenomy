import { describe, it, expect } from "vitest";
import { paymentRequiredBody, verifyPayment } from "../lib/x402";

// buildRequirements / settlePayment / a real verifyPayment all require network access to the
// facilitator (initialize() fetches supported kinds) and are exercised by the Task 10 live test.
// These unit tests cover the offline-safe behavior only.
describe("x402 server wrapper (offline)", () => {
  it("paymentRequiredBody wraps requirements as `accepts`", () => {
    const body = paymentRequiredBody([{ scheme: "exact" } as never]) as { accepts: unknown[]; x402Version: number };
    expect(body.accepts.length).toBe(1);
    expect(body.x402Version).toBe(2);
  });

  it("verifyPayment returns invalid (never throws) for a missing header / no requirements", async () => {
    const v = await verifyPayment("", []);
    expect(v.valid).toBe(false);
  });
});
