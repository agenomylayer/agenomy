import { Pool } from 'pg';
import { getLastBlock, setLastBlock, upsertAgent } from './db';
import { runLoop, enrichWithManifest, type IndexerDeps } from './indexer';
import {
  makeClient,
  getCurrentBlock,
  getBlockTimestamp,
  getLogsChunk,
} from './client';

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main(): Promise<void> {
  const rpcUrl = reqEnv('BASE_SEPOLIA_RPC_URL');
  const databaseUrl = reqEnv('DATABASE_URL');
  const registry = reqEnv('REGISTRY_ADDRESS') as `0x${string}`;
  const gateway = process.env.IPFS_GATEWAY ?? 'https://gateway.pinata.cloud';
  const deployBlock = BigInt(process.env.DEPLOY_BLOCK ?? '0');
  const delayMs = Number(process.env.INDEXER_POLL_MS ?? '5000');

  const client = makeClient(rpcUrl);
  const pool = new Pool({ connectionString: databaseUrl });

  const deps: IndexerDeps = {
    chunkSize: 2000n,
    deployBlock,
    gateway,
    getCurrentBlock: () => getCurrentBlock(client),
    getLastBlock: () => getLastBlock(pool),
    setLastBlock: (b) => setLastBlock(pool, b),
    getLogsChunk: (from, to) => getLogsChunk(client, registry, from, to),
    getBlockTimestamp: (b) => getBlockTimestamp(client, b),
    upsertAgent: (a) => upsertAgent(pool, a),
    enrich: (base, opts) => enrichWithManifest(base, opts),
  };

  console.log(
    `indexer starting: registry=${registry} deployBlock=${deployBlock} gateway=${gateway}`,
  );
  await runLoop(deps, { delayMs });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
