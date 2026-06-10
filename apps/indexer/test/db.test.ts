import { describe, it, expect } from 'vitest';
import { getLastBlock, setLastBlock, upsertAgent, type AgentInsert } from '../src/db';

interface Call {
  text: string;
  values: unknown[];
}

function fakePool(rowsByCall: unknown[][] = []) {
  const calls: Call[] = [];
  let i = 0;
  return {
    calls,
    async query(text: string, values: unknown[] = []) {
      calls.push({ text, values });
      const rows = rowsByCall[i] ?? [];
      i += 1;
      return { rowCount: rows.length, rows };
    },
  };
}

const agent: AgentInsert = {
  agentId: 1n,
  owner: '0x1111111111111111111111111111111111111111',
  wallet: '0x2222222222222222222222222222222222222222',
  handle: 'satoshi',
  manifestHash: '0x' + '11'.repeat(32),
  manifestCid: 'QmTestCid',
  configHash: '0x' + '22'.repeat(32),
  persona: { displayName: 'Sato', bio: 'b', avatarSeed: 'seed' },
  skills: ['action-converter'],
  createdAt: 1700000000n,
  blockNumber: 12345n,
  txHash: '0x' + 'ab'.repeat(32),
};

describe('db helpers', () => {
  it('getLastBlock returns stored last_block or null when row absent', async () => {
    const present = fakePool([[{ last_block: '500' }]]);
    expect(await getLastBlock(present as any)).toBe(500n);
    expect(present.calls[0].text).toContain('SELECT last_block FROM indexer_state WHERE id = 1');

    const absent = fakePool([[]]);
    expect(await getLastBlock(absent as any)).toBeNull();
  });

  it('setLastBlock upserts the singleton state row', async () => {
    const pool = fakePool([[]]);
    await setLastBlock(pool as any, 777n);
    const c = pool.calls[0];
    expect(c.text).toContain('INSERT INTO indexer_state');
    expect(c.text).toContain('ON CONFLICT (id) DO UPDATE');
    expect(c.values).toEqual(['777']);
  });

  it('upsertAgent inserts all columns with ON CONFLICT (agent_id) DO NOTHING', async () => {
    const pool = fakePool([[]]);
    await upsertAgent(pool as any, agent);
    const c = pool.calls[0];
    expect(c.text).toContain('INSERT INTO agents');
    expect(c.text).toContain('ON CONFLICT (agent_id) DO NOTHING');
    // numeric/bigint columns bound as strings; jsonb as JSON text
    expect(c.values[0]).toBe('1');
    expect(c.values[1]).toBe(agent.owner);
    expect(c.values[2]).toBe(agent.wallet);
    expect(c.values[3]).toBe('satoshi');
    expect(c.values[4]).toBe(agent.manifestHash);
    expect(c.values[5]).toBe('QmTestCid');
    expect(c.values[6]).toBe(agent.configHash);
    expect(c.values[7]).toBe(JSON.stringify(agent.persona));
    expect(c.values[8]).toBe(JSON.stringify(agent.skills));
    expect(c.values[9]).toBe('1700000000');
    expect(c.values[10]).toBe('12345');
    expect(c.values[11]).toBe(agent.txHash);
  });
});
