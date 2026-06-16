# Slice 5: Memory — Design Spec

**Date:** 2026-06-16
**Slice:** 5 (Remember) of the Agenomy roadmap.
**Goal:** give every agent persistent memory that the runtime genuinely reads into every run (so the agent remembers across runs) and that the owner can curate, with a content-addressed verifiable artifact. No placeholder UI: memory must actually affect runs.

## Decisions (locked)

- **Two kinds of memory:** `auto` (written automatically after each successful run) + `pinned` (durable facts/instructions written by the owner).
- **Verifiability now = content hash + IPFS snapshot.** Each entry is sha256 content-hashed (DB). The full memory is pinned to IPFS (Pinata, already wired) producing a CID + hash, anchored on owner action. **On-chain attestation is explicitly deferred to mainnet (Slice 6)** and labeled as such in the UI. No gas now.
- **Cost-safe auto-memory:** auto notes are derived from the run's own output (truncated), with **no extra LLM call** (respects the cost-sensitive MiMo key constraint). Auto history is pruned to a cap so it never grows unbounded.
- **UI matches the existing agent console** (`ac-` styling), consistent with the rest of the site.

## Data model — `migrations/005_memory.sql`

```sql
CREATE TABLE IF NOT EXISTS memories (
  id            BIGSERIAL PRIMARY KEY,
  agent_handle  TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'auto',   -- 'auto' | 'pinned'
  content       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,                  -- sha256(content), lowercase hex
  run_id        BIGINT,                         -- the run that produced an auto memory; NULL for pinned
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_agent_idx ON memories (agent_handle, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_snapshots (
  agent_handle  TEXT PRIMARY KEY,
  cid           TEXT NOT NULL,
  hash          TEXT NOT NULL,                  -- sha256 of the canonical snapshot JSON
  entry_count   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Invoker package — `packages/invoker/src/memory.ts`

Pure DB + hashing, no network (keeps the package app-agnostic, usable by both the web run route and the scheduler). Uses the existing `Queryable` pattern. `content_hash` via Node `crypto.createHash("sha256")`.

```ts
export type MemoryKind = "auto" | "pinned";
export interface MemoryRow {
  id: string; agent_handle: string; kind: MemoryKind;
  content: string; content_hash: string; run_id: string | null; created_at: string;
}

export function memoryHash(content: string): string;            // sha256 hex

const AUTO_CAP = 50;        // keep newest 50 auto entries per agent
const AUTO_TRUNC = 240;     // chars stored per auto note

// write a compact auto note from a run's output; prunes to AUTO_CAP. No-op if output is empty.
export async function writeAutoMemory(pool: Queryable, p: { agentHandle: string; skillSlug: string; output: string; runId: string }): Promise<void>;

// owner-curated durable note
export async function writePinnedMemory(pool: Queryable, p: { agentHandle: string; content: string }): Promise<string>; // returns id

export async function listMemory(pool: Queryable, handle: string, limit?: number): Promise<MemoryRow[]>;  // newest first
export async function countMemory(pool: Queryable, handle: string): Promise<number>;
export async function deleteMemory(pool: Queryable, handle: string, id: string): Promise<void>;

// format memory into the prompt block injected into runs (all pinned + newest N auto, char-budgeted)
export async function buildMemoryContext(pool: Queryable, handle: string, opts?: { autoLimit?: number; budget?: number }): Promise<string>;
```

`buildMemoryContext` output shape (empty string if no memory):
```
## Memory
What your owner pinned (treat as always true):
- watch ETH, WETH, USDC
- alert if gas > 5 gwei
Recent activity (most recent first):
- token-price-report: ETH $3,477 · WETH $3,476 · USDC $1.00
- base-gas-check: Base gas 0.006 gwei, low
```
Defaults: all pinned (cap 10) + newest 8 auto, total budget ~1500 chars.

## Runtime — `packages/runtime/src/agent.ts`

`RunAgentInput` gains optional `memory?: string`. In `runAgent`, after building `system` from the skill prompt + persona, append the memory block when present:

```ts
let system = inp.skill.prompt.replace(/\{\{persona\}\}/g, inp.persona || "an autonomous agent");
if (inp.memory && inp.memory.trim()) {
  system += `\n\n${inp.memory.trim()}\n\nUse this memory when relevant. Do not invent memories you do not have.`;
}
```

## Wiring — `packages/invoker/src/invoke.ts`

- **Read:** after the agent lookup, `const memory = await buildMemoryContext(pool, handle);` and pass `memory` into `runAgent({...})`.
- **Write auto:** after `finishRun`, if `result.status === "ok"`, call `writeAutoMemory(pool, { agentHandle: handle, skillSlug, output: result.output, runId })`. Wrapped in try/catch so a memory failure never fails the run. This runs for BOTH manual and scheduled runs (the invoker is shared), so scheduled agents accumulate memory too.

## Web — IPFS snapshot (verifiable artifact)

The invoker stays IPFS-free; pinning is a web concern (reuses the Pinata path behind `/api/manifests`).

- `apps/web/lib/memory-snapshot.ts`: `anchorMemory(pool, handle)` builds a canonical JSON `{ handle, entries: [{id,kind,content,content_hash,created_at}], count }`, pins it to IPFS (same Pinata helper the manifest route uses), computes `hash = sha256(json)`, and upserts `memory_snapshots`. Returns `{ cid, hash, entry_count }`.
- Anchoring is triggered on owner writes/deletes (below) and by a manual "re-anchor" owner action. Auto-writes during runs do NOT anchor (keeps runs fast, avoids pin spam); the snapshot is a point-in-time content-addressed record re-anchored on demand.

## Web — owner auth — `apps/web/lib/owner-auth.ts`

Extend the existing owner-signature pattern (already used for pricing). Add:
```ts
export function memoryPinMessage(handle: string, contentHash: string, ts: number): string;   // `Agenomy: pin memory for ${handle} :: ${contentHash} :: ${ts}`
export function memoryDeleteMessage(handle: string, id: string, ts: number): string;         // `Agenomy: delete memory ${id} for ${handle} at ${ts}`
```
Reuse the existing `verifyOwnerSig`-style verification (viem `verifyMessage`, 10-minute window, owner address from the agent row).

## Web — API routes

- `apps/web/app/api/agents/[handle]/memory/route.ts`
  - `GET` → `{ entries: MemoryRow[], snapshot: { cid, hash, entry_count, updated_at } | null }`.
  - `POST` (owner-signed: `{ content, ts, signature }`) → verify owner over `memoryPinMessage(handle, memoryHash(content), ts)`; reject empty/over-long content (cap ~500 chars); `writePinnedMemory`; `anchorMemory`; return the new entry + snapshot.
- `apps/web/app/api/agents/[handle]/memory/[id]/route.ts`
  - `DELETE` (owner-signed; reads `{ ts, signature }` from the request body) → verify owner over `memoryDeleteMessage`; `deleteMemory`; `anchorMemory`.
- `apps/web/app/api/agents/[handle]/memory/anchor/route.ts`
  - `POST` (owner-signed over `memoryPinMessage(handle, "anchor", ts)`) → `anchorMemory` (manual re-anchor). Dedicated route, mirroring the one-route-per-action style of `schedules/[id]`.

## Web — UI — `apps/web/app/agents/[handle]/MemoryPanel.tsx`

Client component, console-styled (`ac-card`, `ac-sechead` with the chip icon, `ac-feed`/row patterns). Replaces the placeholder `<section id="memory">` in `AgentProfile.tsx`.

- Header: "Memory" + sub "verifiable · IPFS".
- Snapshot line: `anchored to IPFS · <cid short> · <count> entries` with a verify link (`ipfsUrl(gateway, cid)`); a small "on-chain attestation comes with mainnet" honesty note.
- Entries feed: each row shows a kind tag (`pinned` accent / `auto` muted), the content, a relative time, and (owner only) a delete button. Pinned shown first, then recent auto.
- Owner box (reuse `owner-box`): textarea to add a pinned note + "Pin to memory" (signs `memoryPinMessage`) + a "Re-anchor" button.
- Empty state (no entries yet): a short line "No memories yet. This agent will start remembering after its first run."

`AgentProfile.tsx`: replace the placeholder section with `<MemoryPanel handle={agent.handle} owner={agent.owner} ipfsGateway={ipfsGateway} />`. The rail "Memory" nav (in `AgentRail.tsx`) loses its `soon` tag. The hero quick-stats stay exactly as Runs/Earned/Schedules/Skills (no change); the memory entry count is shown in the MemoryPanel header sub-label, not as a 5th hero stat.

## Testing

- `packages/invoker/test/memory.test.ts`: writeAuto (truncation + prune to AUTO_CAP), writePinned, listMemory order, deleteMemory, memoryHash determinism, buildMemoryContext format + budget + empty case.
- `packages/runtime/test/agent.test.ts` (extend): when `memory` is passed, the system message contains the memory block; when absent, it does not.
- `apps/web/test`: memory route GET/POST owner-sig (valid + rejected bad sig + empty content), MemoryPanel renders entries + owner controls (mock wagmi).

## Out of scope (later)

- On-chain attestation / EAS (Slice 6, mainnet). The UI labels this explicitly.
- LLM-distilled auto-memory summaries (cost). Truncated-output notes are the MVP.
- Cross-agent / shared memory, semantic retrieval / embeddings (future roadmap).

## Success criteria

1. Run a skill, then run again: the second run's system prompt contains the first run's note (verifiable in the trace/behavior). Agent demonstrably uses prior context.
2. Owner pins a fact; it appears in every subsequent run's memory block.
3. Memory panel shows entries + an IPFS CID/hash; the CID resolves to the snapshot JSON.
4. No extra LLM call per run; auto history capped at 50.
5. All tests green; deployed; consistent console styling.
