import type { Address, Hex } from "viem";

/** 0x-prefixed 32-byte hash. */
export type Bytes32 = Hex;

export type Persona = {
  displayName: string;
  bio: string;
  avatarSeed: string;
};

export type Manifest = {
  version: 1;
  handle: string;
  owner: Address;
  persona: Persona;
  skills: string[];
  createdAt: number;
};

export type Skill = {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
};

export type AgentSummary = {
  agentId: number;
  handle: string;
  owner: Address;
  wallet: Address;
  skills: string[];
  createdAt: number;
};

export type AgentDetail = AgentSummary & {
  manifestHash: Bytes32;
  manifestCid: string;
  configHash: Bytes32;
  persona: Persona;
  solanaWallet?: string | null;
};

/** On-chain Agent struct mirror (tuple from getAgentByHandle/getAgentById). */
export type Agent = {
  owner: Address;
  wallet: Address;
  manifestHash: Bytes32;
  configHash: Bytes32;
  handle: string;
  createdAt: bigint;
};
