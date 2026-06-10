import type { AgentInsert } from './db';
import type { DecodedSpawnLog, EnrichOptions } from './mapLog';
import { logToAgentBase, enrichWithManifest } from './mapLog';

export interface IndexerDeps {
  chunkSize: bigint;
  deployBlock: bigint;
  gateway: string;
  getCurrentBlock: () => Promise<bigint>;
  getLastBlock: () => Promise<bigint | null>;
  setLastBlock: (block: bigint) => Promise<void>;
  getLogsChunk: (fromBlock: bigint, toBlock: bigint) => Promise<DecodedSpawnLog[]>;
  getBlockTimestamp: (block: bigint) => Promise<bigint>;
  upsertAgent: (agent: AgentInsert) => Promise<boolean>;
  enrich: (base: AgentInsert, opts: EnrichOptions) => Promise<AgentInsert>;
}

/**
 * Process every AgentSpawned log from (last_block+1) to the current head in
 * <=chunkSize windows. Idempotent (db upsert is ON CONFLICT DO NOTHING) and
 * resumable (last_block persisted after each successful chunk). Returns count
 * of logs processed.
 */
export async function runOnce(deps: IndexerDeps): Promise<number> {
  const last = (await deps.getLastBlock()) ?? deps.deployBlock;
  const head = await deps.getCurrentBlock();
  if (head <= last) return 0;

  let processed = 0;
  let from = last + 1n;
  while (from <= head) {
    let to = from + deps.chunkSize - 1n;
    if (to > head) to = head;

    const logs = await deps.getLogsChunk(from, to);
    for (const log of logs) {
      const ts = await deps.getBlockTimestamp(log.blockNumber);
      const base = logToAgentBase(log, ts);
      const enriched = await deps.enrich(base, { gateway: deps.gateway });
      await deps.upsertAgent(enriched);
      processed += 1;
    }

    await deps.setLastBlock(to);
    from = to + 1n;
  }
  return processed;
}

export interface LoopOptions {
  delayMs: number;
  signal?: { aborted: boolean };
}

export async function runLoop(deps: IndexerDeps, opts: LoopOptions): Promise<void> {
  // Default enrich impl if caller passed a thin one.
  for (;;) {
    if (opts.signal?.aborted) return;
    try {
      const n = await runOnce(deps);
      if (n > 0) console.log(`indexed ${n} agents`);
    } catch (err) {
      console.error('indexer poll failed, will retry:', err);
    }
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }
}

// Re-export the real enrich so main.ts can inject it.
export { enrichWithManifest };
