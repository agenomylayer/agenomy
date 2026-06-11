import { describe, it, expect } from "vitest";
import { readClientEnv } from "./env";

describe("readClientEnv", () => {
  it("returns a checksummable registry address and wc id", () => {
    const env = readClientEnv({
      NEXT_PUBLIC_REGISTRY_ADDRESS: "0x00000000000000000000000000000000000000aa",
      NEXT_PUBLIC_WALLETCONNECT_ID: "wc-123",
    });
    expect(env.registryAddress).toBe(
      "0x00000000000000000000000000000000000000aa",
    );
    expect(env.walletConnectId).toBe("wc-123");
  });

  it("throws when registry address is malformed", () => {
    expect(() =>
      readClientEnv({
        NEXT_PUBLIC_REGISTRY_ADDRESS: "nope",
        NEXT_PUBLIC_WALLETCONNECT_ID: "wc-123",
      }),
    ).toThrow(/NEXT_PUBLIC_REGISTRY_ADDRESS/);
  });
});
