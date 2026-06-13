# Agenomy — Slice 1 Design: Agent Identity + Create + Gallery

> **Date:** 2026-06-10
> **Codename:** Agenomy (do not rename until final name is locked)
> **Source of truth:** the project handoff doc. This spec maps to handoff §4.1, §6, §9, §12, §13 (MVP).
> **Status:** Draft — awaiting user review before the per-file execution plan.

---

## 0. Where this fits

The handoff describes ~7 subsystems. That cannot be one spec, so the project is decomposed into vertical slices. This document specs **Slice 1 only**.

| Slice | Scope | Maps to handoff |
|---|---|---|
| **Slice 1 (this doc)** | Agent identity (on-chain smart wallet + registry), `/create` flow, `/agents` gallery + profile | §4.1, MVP surfaces |
| Slice 2 | Skill execution runtime, AI provider router, git-style memory log, EAS memory attestation, read-only on-chain skill index | §4.2, §4.5, §11 |
| Slice 3 (V1) | x402 payments + 0xSplits, skill publishing, earnings/withdraw, attestation viewer | §4.3, §4.4, V1 |
| Slice 4 (V2) | Forking + royalties, leaderboard, explore feed, distributed runtime, docs | V2 |

**MVP = Slice 1 + Slice 2.** Slices 3–4 are V1/V2 and are out of scope until MVP ships.

---

## 1. Locked decisions (approved)

| # | Decision | Rationale |
|---|---|---|
| A | **Wallet = CREATE2 smart-account factory, NOT ERC-6551.** Use Alchemy **LightAccount v2.0.0**. | Handoff wanted "deterministic address from config" — that is CREATE2, not ERC-6551 (which binds to an NFT). LightAccount is a minimal, audited ERC-4337 account with a single EOA owner. |
| B | **Payments deferred to V1 (Slice 3).** Architect the receiver around an arbitrary `payTo` so we are not cornered. | Per handoff MVP scope + user instruction. Verified x402 forward-compat (see §6). |
| C | **Attestation = EAS, not a custom contract.** Deferred to Slice 2. V0 attestations are honestly framed as *operator-signed provenance*, not proof of autonomous work. | Smaller audit surface; EAS is production-ready on Base. |
| D | **Custom Solidity shrunk to ONE contract for MVP: `AgentRegistry`.** Wallet = external audited factory; attestation = EAS; payments = x402+0xSplits (V1). | 5 custom contracts holding real USDC, solo, unaudited, in 6–8 weeks is the biggest risk. One contract is auditable solo. |
| E | **IPFS = Pinata only (drop self-hosted node). ENS subname deferred** (offchain CCIP-Read later); use internal handle for MVP. Free-tier AI keys OK for MVP (skills free). | Verified: kubo under-specced on a $5 VPS; on-chain subnames too costly. |

---

## 2. Corrections to the handoff doc (from verification)

These were confirmed against primary sources on 2026-06-10. **Flagging per handoff §17.2.**

1. **⚠️ Aeon has 197 skills, not 32.** `github.com/aaronjmars/aeon` is real, active, **MIT-licensed**, and its `skills.json` canonical catalog reports `total: 197` (verified two independent ways). The "32" in the handoff is a ~6× undercount. Skills are `skills/<slug>/SKILL.md` with YAML frontmatter (`name`, `description`, plus Aeon extras: `var`, `requires`, `capabilities`, `mcp`, `schedule`) — **fully compatible** with Claude Code / vercel-labs SKILL.md format. **Action:** seed the catalog programmatically from `skills.json` (it is the maintained source of truth and drifts), not a hardcoded number. Preserve MIT attribution (Copyright (c) 2026 Aaron Elijah Mars).
2. **Wallet:** the deterministic address comes from the **LightAccountFactory** (`getAddress(owner, salt)`), not from a "skill manifest hash." Slice 1 stores the manifest hash in our own registry record; the wallet address derives from `(owner, salt)`.
3. **x402 is HTTP-402 API payment** (EIP-3009 `transferWithAuthorization` on USDC, settled by a facilitator), not a custom on-chain `paySkillCall`. A `payTo`→0xSplits split is viable but **not atomic** with v1/PullSplit (needs a separate distribute step); v2 PushSplit auto-distributes. Detail in §6 (Slice 3 forward-compat).
4. **Self-hosted IPFS dropped** for MVP (kubo wants ~6GB RAM; conflicts with Postgres+Node on a $5 box).

---

## 3. Slice 1 goal & boundary

**Goal (one sentence):** A user connects a wallet, creates an agent (handle + chosen skills + persona), the agent receives a deterministic on-chain smart wallet and an on-chain registry record, and the agent appears in a public gallery with a profile page.

**In scope:** `AgentRegistry` contract; LightAccount integration (counterfactual address); manifest pinning to IPFS; read-only skill catalog seeded from Aeon `skills.json`; chain indexer; read API; `/create`, `/agents`, `/agents/[handle]`.

**Explicitly OUT of scope (later slices):** skill *execution*, AI router, memory log, EAS attestation, on-chain skill registry, payments/x402, publishing, forking, leaderboard, explore, ENS, Telegram/notify, **mainnet deploy**. Slice 1 targets **Base Sepolia only**.

---

## 4. Architecture — units

Each unit has one purpose and a defined interface.

### 4.1 `AgentRegistry` (the only custom contract — Foundry/Solidity)

**Purpose:** authoritative on-chain record of agents + handle uniqueness; binds each agent to its LightAccount wallet.

**State:**
```solidity
struct Agent {
    address owner;        // msg.sender at spawn; LightAccount owner
    address wallet;       // counterfactual LightAccount address
    bytes32 manifestHash; // SHA-256 multihash digest of manifest JSON == CIDv0 content address
    bytes32 configHash;   // keccak256 of persona/config (integrity)
    string  handle;       // unique, normalized
    uint64  createdAt;
}
```

**Interface:**
- `spawnAgent(string handle, bytes32 manifestHash, bytes32 configHash, uint256 salt) -> (uint256 agentId, address wallet)`
  - normalize + validate handle (lowercase `[a-z0-9-]`, 3–32 chars), revert `HandleTaken` if used
  - `wallet = LIGHT_ACCOUNT_FACTORY.getAddress(msg.sender, salt)` (counterfactual; **not** deployed here)
  - store `Agent`, index by `handle` and `agentId`, emit `AgentSpawned(agentId, owner, wallet, handle, manifestHash, configHash)`
- views: `getAgentByHandle`, `getAgentById`, `isHandleAvailable(handle)`, `totalAgents()`
- `LIGHT_ACCOUNT_FACTORY` is an immutable constructor arg (per-network).

**Notes:** `manifestHash` doubles as the IPFS anchor (CIDv0 = `base58(0x1220 ‖ digest)`) and a content-integrity check. The wallet is **counterfactual** in Slice 1 (cheap; `getAddress` is a view) and deployed on first use in a later slice — it can still *receive* USDC while undeployed.

### 4.2 LightAccount wallet (external, audited — no custom code)

- Factory `getAddress(owner, salt)` / idempotent `createAccount(owner, salt)`; owner = agent owner EOA; holds USDC natively; owner withdraws via `execute()` (later slice). Addresses in §7.
- `salt = uint256(keccak256(abi.encode(owner, handle)))` → exactly one wallet per `(owner, handle)`; no collisions. Computed client-side and passed to `spawnAgent`.

### 4.3 Manifest + IPFS (Pinata V3)

- Manifest JSON: `{ version, handle, owner, persona, skills: [slug...], createdAt }`.
- Backend pins via Pinata V3 Files API; returns CID. `manifestHash` = the CIDv0 digest, passed into `spawnAgent`.

### 4.4 Skill catalog (read-only seed)

- One-time seed script pulls Aeon `skills.json` → Postgres `skills` (slug, name, description, category, tags, source). Used only to let `/create` list selectable skills. **No on-chain skill registry in Slice 1.** (Many Aeon skills need env/MCP to *run* — irrelevant here since Slice 1 doesn't execute them; flag for Slice 2.)

### 4.5 Indexer (Node service)

- Watches `AgentSpawned` on Base Sepolia (viem `getLogs` polling), upserts into Postgres `agents`; idempotent by `agentId`; persists last-processed block for restart safety.

### 4.6 Read API (Node/Express)

- `GET /api/agents` (list/filter/sort), `GET /api/agents/:handle` (+ manifest from IPFS, cached), `GET /api/agents/handle-available?handle=`, `POST /api/manifests` (pin → `{cid, manifestHash}`), `GET /api/skills`.
- Read-mostly; the spawn tx is signed client-side (wagmi). No private keys server-side in Slice 1.

### 4.7 Frontend (Next.js App Router + wagmi/viem + RainbowKit + Tailwind)

- `/create` wizard: connect → handle (live availability) → pick skills → persona → review → `POST /api/manifests` → compute `salt`/`configHash` → `registry.spawnAgent(...)` → confirm → redirect to profile.
- `/agents` gallery: agent cards (handle, avatar, skill icons, short wallet addr, created), filter by skill/category, sort by recent.
- `/agents/[handle]` profile: identity (handle, owner, wallet + Basescan link), skills, persona, created, manifest CID link. Memory/earnings sections are visible-but-empty placeholders.

---

## 5. Data flow — create

```
connect wallet
  → enter handle ──(GET /handle-available)── disable submit if taken
  → pick skills (GET /skills) + persona
  → build manifest JSON
  → POST /api/manifests  → Pinata pin → { cid, manifestHash }
  → salt = keccak256(owner, handle); configHash = keccak256(config)
  → spawnAgent(handle, manifestHash, configHash, salt)   [user signs]
  → AgentSpawned event
  → indexer upserts → agent appears in /agents and /agents/[handle]
```

---

## 6. Slice 3 (V1) forward-compat — do not corner ourselves

Payments are NOT built now, but Slice 1's wallet choice must not block them. Verified: design the future receiver around (1) arbitrary `payTo` address (EOA now, 0xSplits later), (2) USDC on Base with **6-decimal** base units, (3) EIP-3009 `transferWithAuthorization` via a **pluggable facilitator** (Coinbase CDP hosted facilitator, free tier ~1k tx/mo, swappable). LightAccount holds/receives USDC natively, so nothing here blocks V1. Splitter caveat: `transferWithAuthorization`→Split is not atomic (v1 PullSplit needs a separate `distributeERC20`); use **Splits v2 PushSplit** for near-instant fan-out.

---

## 7. Verified externals (Base Sepolia targets for Slice 1)

| Thing | Address (Base Sepolia = Base mainnet unless noted) |
|---|---|
| LightAccountFactory v2.0.0 (**use this**) | `0x0000000000400CdFef5E2714E63d8040b700BC24` |
| LightAccount v2.0.0 impl | `0x8E8e658E22B12ada97B402fF0b044D6A325013C7` |
| ERC-4337 EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| USDC (Base Sepolia) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| USDC (Base mainnet, future) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| EAS / SchemaRegistry (Slice 2) | `0x4200…0021` / `0x4200…0020` (predeploy, both networks) |
| 0xSplits SplitsWarehouse v2 (Slice 3) | `0x8fb66F38cF86A3d5e8768f8F1754A24A6c661Fb8` |

**Risk note:** never hardcode the *predicted* wallet address — always read `factory.getAddress()` on-chain. LightAccount v2 uses EntryPoint **v0.7** (match bundler/paymaster later). Re-verify addresses before mainnet.

---

## 8. Error handling

- **Handle collision:** API pre-check + on-chain `HandleTaken` revert; submit disabled if taken.
- **Pinata failure:** retry w/ backoff; never submit tx without a CID; manifest pin is idempotent (reuse CID on tx retry).
- **Tx reject/fail:** surface + retry; reuse already-pinned CID.
- **RPC failure:** fallback RPC; indexer resumes from last block.
- **Indexer lag:** optimistic "pending" state from tx receipt until indexed.

---

## 9. Testing

- **Foundry (`AgentRegistry`):** spawn happy path; handle uniqueness revert; handle charset/length validation; `getAddress` matches factory (fork test vs Base Sepolia factory); event emission; owner = `msg.sender`.
- **Backend:** manifest pin (mock Pinata); handle-availability; skills seed integrity.
- **Indexer:** event→row mapping; idempotency; restart from last block.
- **Frontend:** create-wizard validation; gallery/profile render from API.

---

## 10. Aesthetic constraint

Detailed visual design is deferred to the `frontend-design` skill at build time. Recorded constraints (handoff §17.4): **anti-generic crypto — NO default shadcn dark mode, NO purple gradient, NO generic dashboard look.** Agent cards and the profile page get a distinct visual language.

---

## 11. Build/deploy order (detailed in the execution plan)

contracts → deploy to Base Sepolia + verify → seed skill catalog → indexer → read API → frontend (`/create`, `/agents`, `/agents/[handle]`). Per-file breakdown, dependencies, and exact deploy steps come in the writing-plans phase.

---

*End of Slice 1 design.*
