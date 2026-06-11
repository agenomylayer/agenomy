import { describe, it, expect } from "vitest";
import { shortAddress, formatCreatedAt, basescanAddressUrl } from "./format";

describe("shortAddress", () => {
  it("truncates middle", () => {
    expect(shortAddress("0x00000000000000000000000000000000000000bb")).toBe(
      "0x0000…00bb",
    );
  });
  it("returns input when too short", () => {
    expect(shortAddress("0x12")).toBe("0x12");
  });
});

describe("formatCreatedAt", () => {
  it("renders a YYYY-MM-DD date from unix seconds (UTC)", () => {
    expect(formatCreatedAt(1718000000)).toBe("2024-06-10");
  });
});

describe("basescanAddressUrl", () => {
  it("builds a sepolia basescan link", () => {
    expect(
      basescanAddressUrl("0x00000000000000000000000000000000000000bb"),
    ).toBe(
      "https://sepolia.basescan.org/address/0x00000000000000000000000000000000000000bb",
    );
  });
});
