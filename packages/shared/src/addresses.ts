import type { Address } from "viem";
import { baseSepolia } from "viem/chains";

/** Base Sepolia is the ONLY supported network for slice 1. */
export const CHAIN = baseSepolia;
export const CHAIN_ID = 84532 as const;

/** Verified contract addresses (Base Sepolia; also valid on mainnet). */
export const ADDRESSES = {
  /** Alchemy LightAccountFactory v2.0.0 */
  lightAccountFactory: "0x0000000000400CdFef5E2714E63d8040b700BC24" as Address,
  /** LightAccount v2.0.0 implementation */
  lightAccountImpl: "0x8E8e658E22B12ada97B402fF0b044D6A325013C7" as Address,
  /** EntryPoint v0.7 */
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address,
  /** USDC (Base Sepolia) */
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
} as const;

/**
 * AgentRegistry address is deployment-specific. Reads from NEXT_PUBLIC_REGISTRY_ADDRESS
 * (browser/web) or REGISTRY_ADDRESS (node/indexer). Returns undefined if unset.
 */
export function getRegistryAddress(): Address | undefined {
  const v =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
        process.env.REGISTRY_ADDRESS)) ||
    undefined;
  return v ? (v as Address) : undefined;
}
