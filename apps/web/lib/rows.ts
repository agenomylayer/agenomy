import type { Persona } from '@agenomy/shared';
import { deriveSolanaAddress } from './solana';

export interface Skill {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
}

export interface AgentSummary {
  agentId: string;
  handle: string;
  owner: string;
  wallet: string;
  skills: string[];
  createdAt: number;
}

export interface AgentDetail extends AgentSummary {
  manifestHash: string;
  manifestCid: string | null;
  configHash: string;
  persona: Persona | null;
  solanaWallet: string | null;
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asPersona(v: unknown): Persona | null {
  let obj: unknown = v;
  if (typeof v === 'string') {
    try {
      obj = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === 'object') {
    const p = obj as Record<string, unknown>;
    if (
      typeof p.displayName === 'string' &&
      typeof p.bio === 'string' &&
      typeof p.avatarSeed === 'string'
    ) {
      return { displayName: p.displayName, bio: p.bio, avatarSeed: p.avatarSeed };
    }
  }
  return null;
}

export function toSkill(row: Record<string, unknown>): Skill {
  return {
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    category: row.category === null || row.category === undefined ? null : String(row.category),
    tags: asArray(row.tags),
  };
}

export function toAgentSummary(row: Record<string, unknown>): AgentSummary {
  return {
    agentId: String(row.agent_id),
    handle: String(row.handle),
    owner: String(row.owner),
    wallet: String(row.wallet),
    skills: asArray(row.skills),
    createdAt: Number(row.created_at),
  };
}

export function toAgentDetail(row: Record<string, unknown>): AgentDetail {
  return {
    ...toAgentSummary(row),
    manifestHash: String(row.manifest_hash),
    manifestCid:
      row.manifest_cid === null || row.manifest_cid === undefined
        ? null
        : String(row.manifest_cid),
    configHash: String(row.config_hash),
    persona: asPersona(row.persona),
    // Every agent has a Solana identity address: use the explicitly linked one
    // if present, otherwise derive a stable, real address from its Base wallet.
    solanaWallet:
      row.solana_wallet === null || row.solana_wallet === undefined
        ? deriveSolanaAddress(String(row.wallet ?? row.agent_id))
        : String(row.solana_wallet),
  };
}
