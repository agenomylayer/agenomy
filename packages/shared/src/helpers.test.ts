import { describe, it, expect } from "vitest";
import {
  keccak256,
  encodeAbiParameters,
  toHex,
  type Address,
} from "viem";
import {
  cidToBytes32,
  bytes32ToCidV0,
  computeSalt,
  computeConfigHash,
  buildManifest,
} from "./helpers";

// A real CIDv0 (sha2-256 multihash, base58btc). The "empty directory" CID.
const KNOWN_CID = "QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn";

describe("cidToBytes32 <-> bytes32ToCidV0", () => {
  it("round-trips a known CIDv0", () => {
    const h = cidToBytes32(KNOWN_CID);
    expect(h).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(bytes32ToCidV0(h)).toBe(KNOWN_CID);
  });

  it("round-trips arbitrary 32-byte digests", () => {
    const digest =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const cid = bytes32ToCidV0(digest);
    expect(cid.startsWith("Qm")).toBe(true);
    expect(cidToBytes32(cid).toLowerCase()).toBe(digest);
  });
});

describe("computeSalt", () => {
  const owner = "0x1234567890123456789012345678901234567890" as Address;

  it("is deterministic for the same (owner, handle)", () => {
    expect(computeSalt(owner, "alpha")).toBe(computeSalt(owner, "alpha"));
  });

  it("differs across handles", () => {
    expect(computeSalt(owner, "alpha")).not.toBe(computeSalt(owner, "beta"));
  });

  it("matches Solidity keccak256(abi.encode(owner, handle))", () => {
    const expected = BigInt(
      keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "string" }],
          [owner, "alpha"],
        ),
      ),
    );
    expect(computeSalt(owner, "alpha")).toBe(expected);
  });
});

describe("computeConfigHash", () => {
  it("is deterministic regardless of key insertion order", () => {
    const a = computeConfigHash({ b: 2, a: 1 });
    const b = computeConfigHash({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toBe(keccak256(toHex(JSON.stringify({ a: 1, b: 2 }))));
  });
});

describe("buildManifest", () => {
  it("builds a versioned manifest with provided fields", () => {
    const owner = "0x1234567890123456789012345678901234567890" as Address;
    const m = buildManifest({
      handle: "alpha",
      owner,
      persona: { displayName: "Alpha", bio: "hi", avatarSeed: "seed-1" },
      skills: ["summarize"],
      createdAt: 1718000000,
    });
    expect(m.version).toBe(1);
    expect(m.handle).toBe("alpha");
    expect(m.owner).toBe(owner);
    expect(m.skills).toEqual(["summarize"]);
  });
});
