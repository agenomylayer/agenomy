import bs58 from "bs58";
import {
  keccak256,
  encodeAbiParameters,
  toHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { ADDRESSES } from "./addresses";
import { lightAccountFactoryAbi } from "./abi";
import type { Manifest, Persona } from "./types";

/**
 * salt = uint256(keccak256(abi.encode(owner, handle))) — matches AgentRegistry.sol.
 * NOTE: the contract computes salt from msg.sender; clients must pass the same owner.
 */
export function computeSalt(owner: Address, handle: string): bigint {
  return BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "string" }],
        [owner, handle],
      ),
    ),
  );
}

/** Recursively sort object keys to produce a canonical, stable JSON string. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

/**
 * keccak256 of the canonical JSON string of `config`.
 * Canonical = recursively key-sorted, so logically-equal configs hash equally.
 */
export function computeConfigHash(config: object): Hex {
  return keccak256(toHex(JSON.stringify(canonicalize(config))));
}

/**
 * CIDv0 (base58btc sha2-256 multihash) -> 32-byte digest as 0x hex.
 * Decoded bytes are [0x12, 0x20, ...32 digest bytes]; strip the 2-byte prefix.
 */
export function cidToBytes32(cidV0: string): Hex {
  const bytes = bs58.decode(cidV0);
  if (bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) {
    throw new Error(`Not a sha2-256 CIDv0: ${cidV0}`);
  }
  const digest = bytes.slice(2);
  return ("0x" +
    Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    )) as Hex;
}

/**
 * 32-byte digest (0x hex) -> CIDv0 by prepending the sha2-256 multihash prefix
 * [0x12, 0x20] and base58btc-encoding the 34 bytes.
 */
export function bytes32ToCidV0(h: Hex): string {
  const hex = h.startsWith("0x") ? h.slice(2) : h;
  if (hex.length !== 64) {
    throw new Error(`Expected 32-byte hex, got length ${hex.length}`);
  }
  const digest = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    digest[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const full = new Uint8Array(34);
  full[0] = 0x12;
  full[1] = 0x20;
  full.set(digest, 2);
  return bs58.encode(full);
}

/**
 * Predicts the counterfactual LightAccount wallet for (owner, handle):
 * factory.getAddress(owner, computeSalt(owner, handle)). Wallet is NOT deployed in slice 1.
 */
export async function predictWallet(
  publicClient: PublicClient,
  owner: Address,
  handle: string,
): Promise<Address> {
  return (await publicClient.readContract({
    address: ADDRESSES.lightAccountFactory,
    abi: lightAccountFactoryAbi,
    functionName: "getAddress",
    args: [owner, computeSalt(owner, handle)],
  })) as Address;
}

/** Assemble a version-1 Manifest from its parts. */
export function buildManifest(input: {
  handle: string;
  owner: Address;
  persona: Persona;
  skills: string[];
  createdAt: number;
}): Manifest {
  return {
    version: 1,
    handle: input.handle,
    owner: input.owner,
    persona: input.persona,
    skills: input.skills,
    createdAt: input.createdAt,
  };
}
