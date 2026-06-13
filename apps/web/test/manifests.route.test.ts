import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/manifests/route';
import { __setPinataFetchForTests } from '../lib/pinata';
import { cidToBytes32 } from '@agenomy/shared';

const VALID_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

const manifest = {
  version: 1,
  handle: 'satoshi',
  owner: '0x1111111111111111111111111111111111111111',
  persona: { displayName: 'Sato', bio: 'b', avatarSeed: 'seed' },
  skills: ['action-converter'],
  createdAt: 1700000000,
};

function req(body: unknown) {
  return new Request('http://localhost/api/manifests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __setPinataFetchForTests(null);
  process.env.PINATA_JWT = 'test-jwt';
});

describe('POST /api/manifests', () => {
  it('pins the manifest to Pinata and returns { cid, manifestHash }', async () => {
    const fakeFetch = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.pinata.cloud/pinning/pinJSONToIPFS');
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-jwt');
      const sent = JSON.parse(init.body as string);
      expect(sent.pinataContent).toEqual(manifest);
      return {
        ok: true,
        async json() {
          return { IpfsHash: VALID_CID };
        },
      } as any;
    });
    __setPinataFetchForTests(fakeFetch as any);

    const res = await POST(req({ manifest }));
    expect(res.status).toBe(200);
    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({
      cid: VALID_CID,
      manifestHash: cidToBytes32(VALID_CID),
    });
  });

  it('returns 400 when manifest is missing from the body', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns 502 when Pinata responds non-ok', async () => {
    const fakeFetch = vi.fn(async () => ({ ok: false, status: 401, async text() { return 'unauthorized'; } }) as any);
    __setPinataFetchForTests(fakeFetch as any);
    const res = await POST(req({ manifest }));
    expect(res.status).toBe(502);
  });
});
