import { createHash } from "node:crypto";
import { getPool } from "./db";
import { listMemory, upsertMemorySnapshot } from "@agenomy/invoker";
import { pinJSON } from "./pinata";

/** Build the agent's full memory snapshot, pin it to IPFS, and record the pointer. */
export async function anchorMemory(handle: string): Promise<{ cid: string; hash: string; entryCount: number }> {
  const pool = getPool();
  const entries = await listMemory(pool, handle, 1000);
  const snapshot = {
    handle,
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      content: e.content,
      content_hash: e.content_hash,
      created_at: e.created_at,
    })),
  };
  const hash = createHash("sha256").update(JSON.stringify(snapshot), "utf8").digest("hex");
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not configured");
  const cid = await pinJSON(snapshot, jwt);
  await upsertMemorySnapshot(pool, handle, { cid, hash, entryCount: entries.length });
  return { cid, hash, entryCount: entries.length };
}
