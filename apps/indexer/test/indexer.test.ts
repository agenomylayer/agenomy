import { describe, it, expect, vi } from 'vitest';
import { runOnce, type IndexerDeps } from '../src/indexer';

const manifestHash = ('0x' + '12'.repeat(32)) as `0x${string}`;
const configHash = ('0x' + '34'.repeat(32)) as `0x${string}`;

function makeLog(agentId: bigint, block: bigint) {
  return {
    args: {
      agentId,
      owner: '0x1111111111111111111111111111111111111111',
      wallet: '0x2222222222222222222222222222222222222222',
      handle: `agent-${agentId}`,
      manifestHash,
      configHash,
    },
    blockNumber: block,
    transactionHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
  };
}

function deps(overrides: Partial<IndexerDeps> = {}): IndexerDeps {
  const upserted: bigint[] = [];
  const blockTimestamps: Record<string, bigint> = { '50': 1700000000n };
  return {
    chunkSize: 2000n,
    deployBlock: 100n,
    gateway: 'https://gw.example',
    getCurrentBlock: vi.fn(async () => 100n),
    getLastBlock: vi.fn(async () => null),
    setLastBlock: vi.fn(async () => {}),
    getLogsChunk: vi.fn(async () => []),
    getBlockTimestamp: vi.fn(async (b: bigint) => blockTimestamps[b.toString()] ?? 1700000000n),
    upsertAgent: vi.fn(async (a: any) => {
      upserted.push(a.agentId);
      return true;
    }),
    enrich: vi.fn(async (base: any) => base),
    // expose for assertions
    _upserted: upserted,
    ...overrides,
  } as any;
}

describe('runOnce', () => {
  it('does nothing when last processed block >= current head', async () => {
    const d = deps({
      getLastBlock: vi.fn(async () => 100n),
      getCurrentBlock: vi.fn(async () => 100n),
    });
    const processed = await runOnce(d);
    expect(processed).toBe(0);
    expect(d.getLogsChunk).not.toHaveBeenCalled();
    expect(d.setLastBlock).not.toHaveBeenCalled();
  });

  it('defaults from deployBlock when indexer_state is empty and scans to head in <=2000 chunks', async () => {
    const d = deps({
      deployBlock: 100n,
      getLastBlock: vi.fn(async () => null),
      getCurrentBlock: vi.fn(async () => 4500n),
      getLogsChunk: vi.fn(async () => []),
    });
    await runOnce(d);
    // from 101..4500 => chunks [101..2100], [2101..4100], [4101..4500] = 3 calls
    expect((d.getLogsChunk as any).mock.calls.length).toBe(3);
    const calls = (d.getLogsChunk as any).mock.calls;
    expect(calls[0].slice(0, 2)).toEqual([101n, 2100n]);
    expect(calls[1].slice(0, 2)).toEqual([2101n, 4100n]);
    expect(calls[2].slice(0, 2)).toEqual([4101n, 4500n]);
    expect(d.setLastBlock).toHaveBeenLastCalledWith(4500n);
  });

  it('upserts every decoded log (enriched) and persists the head', async () => {
    const logs = [makeLog(1n, 120n), makeLog(2n, 130n)];
    const d = deps({
      getLastBlock: vi.fn(async () => 100n),
      getCurrentBlock: vi.fn(async () => 200n),
      getLogsChunk: vi.fn(async () => logs),
    });
    const processed = await runOnce(d);
    expect(processed).toBe(2);
    expect((d as any)._upserted).toEqual([1n, 2n]);
    expect(d.enrich).toHaveBeenCalledTimes(2);
    expect(d.setLastBlock).toHaveBeenLastCalledWith(200n);
  });

  it('resumes from persisted last_block on a second run (no rescanning old blocks)', async () => {
    const d = deps({
      getLastBlock: vi.fn(async () => 200n),
      getCurrentBlock: vi.fn(async () => 250n),
      getLogsChunk: vi.fn(async () => []),
    });
    await runOnce(d);
    const calls = (d.getLogsChunk as any).mock.calls;
    expect(calls[0].slice(0, 2)).toEqual([201n, 250n]);
  });
});
