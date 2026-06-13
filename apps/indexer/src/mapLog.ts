import { bytes32ToCidV0, type Persona, type Manifest } from '@agenomy/shared';
import type { AgentInsert } from './db';

export interface DecodedSpawnLog {
  args: {
    agentId: bigint;
    owner: `0x${string}`;
    wallet: `0x${string}`;
    handle: string;
    manifestHash: `0x${string}`;
    configHash: `0x${string}`;
  };
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export interface EnrichOptions {
  gateway: string;
  fetchImpl?: typeof fetch;
}

/** Map a decoded AgentSpawned log into an AgentInsert with manifest fields still empty. */
export function logToAgentBase(log: DecodedSpawnLog, createdAt: bigint): AgentInsert {
  return {
    agentId: log.args.agentId,
    owner: log.args.owner,
    wallet: log.args.wallet,
    handle: log.args.handle,
    manifestHash: log.args.manifestHash,
    manifestCid: null,
    configHash: log.args.configHash,
    persona: null,
    skills: [],
    createdAt,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
  };
}

/**
 * Resolve the CIDv0 from manifestHash, fetch the manifest JSON from the IPFS
 * gateway, and fill persona/skills/manifestCid. On any fetch/parse failure we
 * still record the manifestCid (it is derived, not fetched) and leave persona
 * null / skills [] so the indexer remains resilient and idempotent.
 */
export async function enrichWithManifest(
  base: AgentInsert,
  opts: EnrichOptions,
): Promise<AgentInsert> {
  const cid = bytes32ToCidV0(base.manifestHash as `0x${string}`);
  const gw = opts.gateway.replace(/\/+$/, '');
  const url = `${gw}/ipfs/${cid}`;
  const f = opts.fetchImpl ?? fetch;

  const enriched: AgentInsert = { ...base, manifestCid: cid };
  try {
    const res = await f(url);
    if (!res.ok) return enriched;
    const manifest = (await res.json()) as Partial<Manifest>;
    const persona = manifest.persona;
    if (
      persona &&
      typeof persona.displayName === 'string' &&
      typeof persona.bio === 'string' &&
      typeof persona.avatarSeed === 'string'
    ) {
      enriched.persona = persona as Persona;
    }
    if (Array.isArray(manifest.skills)) {
      enriched.skills = manifest.skills.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // swallow — derived cid already recorded; persona/skills stay empty
  }
  return enriched;
}
