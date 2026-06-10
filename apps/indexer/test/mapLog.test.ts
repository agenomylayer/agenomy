import { describe, it, expect, vi } from 'vitest';
import { logToAgentBase, enrichWithManifest, type DecodedSpawnLog } from '../src/mapLog';
import { bytes32ToCidV0 } from '@aeonomy/shared';

const manifestHash = ('0x' + '12'.repeat(32)) as `0x${string}`;
const configHash = ('0x' + '34'.repeat(32)) as `0x${string}`;

const log: DecodedSpawnLog = {
  args: {
    agentId: 7n,
    owner: '0x1111111111111111111111111111111111111111',
    wallet: '0x2222222222222222222222222222222222222222',
    handle: 'orbit',
    manifestHash,
    configHash,
  },
  blockNumber: 99n,
  transactionHash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
};

describe('logToAgentBase', () => {
  it('maps decoded event args + block/tx into the base AgentInsert (persona/skills empty, cid null)', () => {
    const base = logToAgentBase(log, 1700001234n);
    expect(base.agentId).toBe(7n);
    expect(base.owner).toBe(log.args.owner);
    expect(base.wallet).toBe(log.args.wallet);
    expect(base.handle).toBe('orbit');
    expect(base.manifestHash).toBe(manifestHash);
    expect(base.configHash).toBe(configHash);
    expect(base.createdAt).toBe(1700001234n);
    expect(base.blockNumber).toBe(99n);
    expect(base.txHash).toBe(log.args.wallet ? log.transactionHash : '');
    expect(base.persona).toBeNull();
    expect(base.skills).toEqual([]);
    expect(base.manifestCid).toBeNull();
  });
});

describe('enrichWithManifest', () => {
  it('fetches IPFS_GATEWAY/ipfs/<cid> via bytes32ToCidV0 and fills persona/skills/manifestCid', async () => {
    const base = logToAgentBase(log, 1700001234n);
    const expectedCid = bytes32ToCidV0(manifestHash);
    const fakeFetch = vi.fn(async (url: string) => {
      expect(url).toBe(`https://gw.example/ipfs/${expectedCid}`);
      return {
        ok: true,
        async json() {
          return {
            version: 1,
            handle: 'orbit',
            owner: log.args.owner,
            persona: { displayName: 'Orbit', bio: 'hi', avatarSeed: 'xyz' },
            skills: ['action-converter', 'agent-buzz'],
            createdAt: 1700001234,
          };
        },
      } as any;
    });
    const out = await enrichWithManifest(base, {
      gateway: 'https://gw.example',
      fetchImpl: fakeFetch as any,
    });
    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(out.manifestCid).toBe(expectedCid);
    expect(out.persona).toEqual({ displayName: 'Orbit', bio: 'hi', avatarSeed: 'xyz' });
    expect(out.skills).toEqual(['action-converter', 'agent-buzz']);
  });

  it('still sets manifestCid but leaves persona/skills empty when the gateway fetch fails', async () => {
    const base = logToAgentBase(log, 1700001234n);
    const expectedCid = bytes32ToCidV0(manifestHash);
    const fakeFetch = vi.fn(async () => ({ ok: false, status: 500 }) as any);
    const out = await enrichWithManifest(base, {
      gateway: 'https://gw.example',
      fetchImpl: fakeFetch as any,
    });
    expect(out.manifestCid).toBe(expectedCid);
    expect(out.persona).toBeNull();
    expect(out.skills).toEqual([]);
  });

  it('trims a trailing slash on the gateway base', async () => {
    const base = logToAgentBase(log, 1700001234n);
    const expectedCid = bytes32ToCidV0(manifestHash);
    const fakeFetch = vi.fn(async (url: string) => {
      expect(url).toBe(`https://gw.example/ipfs/${expectedCid}`);
      return { ok: false, status: 404 } as any;
    });
    await enrichWithManifest(base, {
      gateway: 'https://gw.example/',
      fetchImpl: fakeFetch as any,
    });
    expect(fakeFetch).toHaveBeenCalledOnce();
  });
});
