import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/agents/[handle]/route';
import { __setPoolForTests } from '../lib/db';

function req(handle: string) {
  return new Request(new URL(`http://localhost/api/agents/${handle}`));
}

const ctx = (handle: string) => ({ params: Promise.resolve({ handle }) });

beforeEach(() => __setPoolForTests(null));

const detailRow = {
  agent_id: '1',
  owner: '0x1111111111111111111111111111111111111111',
  wallet: '0x2222222222222222222222222222222222222222',
  handle: 'satoshi',
  skills: ['action-converter'],
  created_at: '1700000000',
  manifest_hash: '0x' + '11'.repeat(32),
  manifest_cid: 'QmTestCid',
  config_hash: '0x' + '22'.repeat(32),
  persona: { displayName: 'Sato', bio: 'b', avatarSeed: 'seed' },
};

describe('GET /api/agents/[handle]', () => {
  it('returns { agent } as AgentDetail when found', async () => {
    __setPoolForTests({ async query() { return { rowCount: 1, rows: [detailRow] }; } });
    const res = await GET(req('satoshi'), ctx('satoshi'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent).toEqual({
      agentId: '1',
      handle: 'satoshi',
      owner: '0x1111111111111111111111111111111111111111',
      wallet: '0x2222222222222222222222222222222222222222',
      skills: ['action-converter'],
      createdAt: 1700000000,
      manifestHash: '0x' + '11'.repeat(32),
      manifestCid: 'QmTestCid',
      configHash: '0x' + '22'.repeat(32),
      persona: { displayName: 'Sato', bio: 'b', avatarSeed: 'seed' },
    });
  });

  it('returns 404 when the handle is missing', async () => {
    __setPoolForTests({ async query() { return { rowCount: 0, rows: [] }; } });
    const res = await GET(req('nobody'), ctx('nobody'));
    expect(res.status).toBe(404);
  });
});
