const PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

let _fetch: typeof fetch | null = null;

/** Test seam: inject a fake fetch. Pass null to restore global fetch. */
export function __setPinataFetchForTests(f: typeof fetch | null): void {
  _fetch = f;
}

export class PinataError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PinataError';
    this.status = status;
  }
}

/**
 * Pin a JSON object to IPFS via Pinata pinJSONToIPFS, returning the CIDv0.
 * Requires PINATA_JWT. Throws PinataError on a non-ok response.
 */
export async function pinJSON(content: unknown, jwt: string): Promise<string> {
  const f = _fetch ?? fetch;
  const res = await f(PIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ pinataContent: content }),
  });
  if (!res.ok) {
    const detail = typeof res.text === 'function' ? await res.text() : '';
    throw new PinataError(`Pinata pin failed (${res.status}): ${detail}`, res.status);
  }
  const json = (await res.json()) as { IpfsHash?: string };
  if (!json.IpfsHash) {
    throw new PinataError('Pinata response missing IpfsHash', 502);
  }
  return json.IpfsHash;
}
