import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { DecodedSpawnLog } from './mapLog';

export const AGENT_SPAWNED_EVENT = parseAbiItem(
  'event AgentSpawned(uint256 indexed agentId, address indexed owner, address wallet, string handle, bytes32 manifestHash, bytes32 configHash)',
);

export function makeClient(rpcUrl: string): PublicClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  }) as unknown as PublicClient;
}

export async function getCurrentBlock(client: PublicClient): Promise<bigint> {
  return client.getBlockNumber();
}

export async function getBlockTimestamp(client: PublicClient, block: bigint): Promise<bigint> {
  const b = await client.getBlock({ blockNumber: block });
  return b.timestamp;
}

export async function getLogsChunk(
  client: PublicClient,
  address: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<DecodedSpawnLog[]> {
  const logs = await client.getLogs({
    address,
    event: AGENT_SPAWNED_EVENT,
    fromBlock,
    toBlock,
  });
  return logs.map((l) => ({
    args: {
      agentId: l.args.agentId as bigint,
      owner: l.args.owner as `0x${string}`,
      wallet: l.args.wallet as `0x${string}`,
      handle: l.args.handle as string,
      manifestHash: l.args.manifestHash as `0x${string}`,
      configHash: l.args.configHash as `0x${string}`,
    },
    blockNumber: l.blockNumber as bigint,
    transactionHash: l.transactionHash as `0x${string}`,
  }));
}
