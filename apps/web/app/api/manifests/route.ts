import { NextResponse } from 'next/server';
import { cidToBytes32, type Manifest } from '@aeonomy/shared';
import { pinJSON, PinataError } from '../../../lib/pinata';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: { manifest?: Manifest };
  try {
    body = (await request.json()) as { manifest?: Manifest };
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const manifest = body.manifest;
  if (!manifest || typeof manifest !== 'object') {
    return NextResponse.json({ error: 'manifest is required' }, { status: 400 });
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: 'PINATA_JWT not configured' }, { status: 500 });
  }

  try {
    const cid = await pinJSON(manifest, jwt);
    const manifestHash = cidToBytes32(cid);
    return NextResponse.json({ cid, manifestHash });
  } catch (err) {
    if (err instanceof PinataError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: 'failed to pin manifest' }, { status: 502 });
  }
}
