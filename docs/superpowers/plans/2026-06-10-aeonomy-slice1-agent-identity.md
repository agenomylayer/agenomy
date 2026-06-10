# Aeonomy Slice 1 — Agent Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect a wallet and spawn an agent (handle + chosen skills + persona) that receives a deterministic on-chain smart wallet and an on-chain registry record, then appears in a public gallery with a profile page — on Base Sepolia.

**Architecture:** A pnpm monorepo. One custom Solidity contract (`AgentRegistry`) binds each agent to a counterfactual Alchemy LightAccount wallet via the audited LightAccountFactory. A standalone Node indexer mirrors `AgentSpawned` events into Postgres; a Next.js 15 app serves the read API (route handlers), pins manifests to IPFS (Pinata), and renders `/create`, `/agents`, `/agents/[handle]`. Shared TypeScript types/ABI/helpers live in `packages/shared`.

**Tech Stack:** Foundry (Solidity ^0.8.24), Node 20 + pnpm, TypeScript 5, viem 2, Next.js 15 (App Router), wagmi 2 + RainbowKit 2, Tailwind, node-postgres (`pg`), Vitest 2. Network: Base Sepolia only.

**Build order (dependency-sorted):** Phase 0 scaffold → Phase 1 contracts → Phase 2 backend → Phase 3 frontend.

**Companion spec:** [docs/superpowers/specs/2026-06-10-aeonomy-slice1-agent-identity-design.md](../specs/2026-06-10-aeonomy-slice1-agent-identity-design.md) — read first for locked decisions A–E, verified addresses, and the fixed shared interface.

---

## Phase 0: Monorepo scaffold & shared package

This phase creates the pnpm workspace skeleton, the local Postgres stack with the exact DDL, and the `packages/shared` TypeScript package (addresses, chain config, ABI, types, deterministic helpers) that both `apps/web` and `apps/indexer` consume. It ends with a green `pnpm -w test` running Vitest for the shared package.

All commands assume the repo root is the current working directory: `c:\Users\ridzk\Music\claude code\basedeploy5`. Use a POSIX-style shell (the Bash tool) for the command blocks below; paths are relative to repo root.

Prerequisites (verify once, do not script): `node -v` reports v20+, `pnpm -v` reports 9+, and `docker -v` succeeds. If `pnpm` is missing: `corepack enable && corepack prepare pnpm@9 --activate`.

---

### Task 1: Initialize git repo and root workspace files

**Files:**
- Create: `.gitignore`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.npmrc`

- [ ] **Step 1: Initialize git.** Run:
  ```bash
  git init
  ```
  Expected output: `Initialized empty Git repository in .../basedeploy5/.git/`.

- [ ] **Step 2: Create `.gitignore`** with full contents:
  ```gitignore
  # deps
  node_modules/
  .pnpm-store/

  # builds
  dist/
  build/
  out/
  .next/
  *.tsbuildinfo

  # foundry
  packages/contracts/out/
  packages/contracts/cache/
  packages/contracts/broadcast/
  packages/contracts/lib/

  # env
  .env
  .env.local
  .env.*.local

  # logs
  *.log
  npm-debug.log*
  pnpm-debug.log*

  # os / editor
  .DS_Store
  Thumbs.db
  .idea/
  .vscode/

  # docker volumes (local)
  .pgdata/

  # test/coverage
  coverage/
  ```

- [ ] **Step 3: Create `pnpm-workspace.yaml`** with full contents (globs MUST include `packages/contracts` even though Foundry is initialized in Phase 1, plus shared, web, and indexer):
  ```yaml
  packages:
    - "packages/*"
    - "apps/*"
  ```

- [ ] **Step 4: Create `.npmrc`** with full contents (keeps deterministic, non-hoisted installs and silences engine churn):
  ```ini
  auto-install-peers=true
  strict-peer-dependencies=false
  ```

- [ ] **Step 5: Create root `package.json`** with full contents. The `test` script delegates to the workspace recursively so `pnpm -w test` runs every package's `test` script; `db:up`/`db:down`/`db:migrate` wrap docker + psql:
  ```json
  {
    "name": "aeonomy",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "engines": {
      "node": ">=20"
    },
    "packageManager": "pnpm@9.12.0",
    "scripts": {
      "test": "pnpm -r --if-present test",
      "build": "pnpm -r --if-present build",
      "typecheck": "pnpm -r --if-present typecheck",
      "db:up": "docker compose up -d",
      "db:down": "docker compose down",
      "db:migrate": "docker compose exec -T postgres psql -U aeon -d aeonomy -f /migrations/001_init.sql"
    },
    "devDependencies": {
      "typescript": "^5.5.4"
    }
  }
  ```

- [ ] **Step 6: Create the app/package directory placeholders** so the workspace globs resolve and Phase 1+ have homes. Run:
  ```bash
  mkdir -p packages/contracts packages/shared apps/indexer apps/web migrations
  ```
  Expected: no output (directories created). `packages/contracts` is intentionally empty here; Phase 1 runs `forge init` into it.

- [ ] **Step 7: Install root dev deps to materialize the lockfile.** Run:
  ```bash
  pnpm install
  ```
  Expected output ends with `Done in ...` and a `pnpm-lock.yaml` now exists at repo root. A warning that `packages/contracts` has no `package.json` is fine to ignore at this stage.

- [ ] **Step 8: Commit.** Run:
  ```bash
  git add .gitignore pnpm-workspace.yaml .npmrc package.json pnpm-lock.yaml
  git commit -m "chore: scaffold pnpm monorepo root and workspace globs"
  ```
  Expected output: a commit summary listing the 5 files.

---

### Task 2: Local Postgres via docker-compose + migrations DDL

**Files:**
- Create: `docker-compose.yml`
- Create: `migrations/001_init.sql`
- Create: `.env.example`

- [ ] **Step 1: Create `docker-compose.yml`** (Postgres 16, named `postgres`, mounts the `migrations/` dir read-only so `db:migrate` can `psql -f /migrations/001_init.sql`). Full contents:
  ```yaml
  services:
    postgres:
      image: postgres:16
      container_name: aeonomy-postgres
      restart: unless-stopped
      environment:
        POSTGRES_USER: aeon
        POSTGRES_PASSWORD: aeon
        POSTGRES_DB: aeonomy
      ports:
        - "5432:5432"
      volumes:
        - ./.pgdata:/var/lib/postgresql/data
        - ./migrations:/migrations:ro
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U aeon -d aeonomy"]
        interval: 5s
        timeout: 5s
        retries: 10
  ```

- [ ] **Step 2: Create `migrations/001_init.sql`** with the EXACT DDL from the shared interface (three tables: `skills`, `agents`, `indexer_state`). Full contents:
  ```sql
  -- Aeonomy slice 1 schema. Idempotent: safe to re-run.

  CREATE TABLE IF NOT EXISTS skills (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT,
    tags        JSONB NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'aeon'
  );

  CREATE TABLE IF NOT EXISTS agents (
    agent_id      BIGINT PRIMARY KEY,
    owner         TEXT NOT NULL,
    wallet        TEXT NOT NULL,
    handle        TEXT UNIQUE NOT NULL,
    manifest_hash TEXT NOT NULL,
    manifest_cid  TEXT,
    config_hash   TEXT NOT NULL,
    persona       JSONB,
    skills        JSONB NOT NULL DEFAULT '[]',
    created_at    BIGINT NOT NULL,
    block_number  BIGINT NOT NULL,
    tx_hash       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS indexer_state (
    id         INT PRIMARY KEY DEFAULT 1,
    last_block BIGINT NOT NULL
  );

  -- Helpful read-path indexes (filters/sorts in the read API).
  CREATE INDEX IF NOT EXISTS agents_created_at_idx ON agents (created_at DESC);
  CREATE INDEX IF NOT EXISTS agents_owner_idx ON agents (owner);
  ```

- [ ] **Step 3: Create `.env.example`** documenting every env var from the shared interface (no secrets, placeholders only):
  ```ini
  # --- network ---
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

  # --- contracts (deploy only) ---
  DEPLOYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000

  # --- IPFS / Pinata ---
  PINATA_JWT=
  IPFS_GATEWAY=https://gateway.pinata.cloud

  # --- database ---
  DATABASE_URL=postgres://aeon:aeon@localhost:5432/aeonomy

  # --- registry / indexer ---
  REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
  DEPLOY_BLOCK=0

  # --- frontend (public) ---
  NEXT_PUBLIC_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
  NEXT_PUBLIC_WALLETCONNECT_ID=
  ```

- [ ] **Step 4: Bring up Postgres and apply the migration.** Run:
  ```bash
  pnpm db:up
  ```
  Expected: `Container aeonomy-postgres  Started` (or `Created`/`Running`). Then wait for health and migrate:
  ```bash
  docker compose exec -T postgres pg_isready -U aeon -d aeonomy
  pnpm db:migrate
  ```
  Expected output of `pg_isready`: `... accepting connections`. Expected output of `db:migrate`: a sequence of `CREATE TABLE` / `CREATE INDEX` lines with no errors. Re-running `pnpm db:migrate` MUST stay clean (idempotent) — re-run once to confirm only `NOTICE ... already exists, skipping` appears.

- [ ] **Step 5: Verify tables exist.** Run:
  ```bash
  docker compose exec -T postgres psql -U aeon -d aeonomy -c "\dt"
  ```
  Expected: a table listing that includes `agents`, `indexer_state`, and `skills`.

- [ ] **Step 6: Commit.** Run:
  ```bash
  git add docker-compose.yml migrations/001_init.sql .env.example
  git commit -m "chore: add Postgres 16 compose stack and 001_init schema"
  ```
  Expected output: a commit summary listing the 3 files.

---

### Task 3: Scaffold `packages/shared` package (config, deps, tsconfig)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`

- [ ] **Step 1: Create `packages/shared/package.json`** exporting from `src/index.ts`, depending on `viem` and `bs58`, with `test`/`typecheck`/`build` scripts. Full contents:
  ```json
  {
    "name": "@aeonomy/shared",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
      ".": "./src/index.ts"
    },
    "scripts": {
      "test": "vitest run",
      "test:watch": "vitest",
      "typecheck": "tsc --noEmit",
      "build": "tsc -p tsconfig.json"
    },
    "dependencies": {
      "bs58": "^6.0.0",
      "viem": "^2.21.0"
    },
    "devDependencies": {
      "typescript": "^5.5.4",
      "vitest": "^2.1.0"
    }
  }
  ```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`** (modern ESM, strict, bundler resolution so deep `viem` subpath imports resolve). Full contents:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "lib": ["ES2022"],
      "strict": true,
      "declaration": true,
      "outDir": "dist",
      "rootDir": "src",
      "esModuleInterop": true,
      "forceConsistentCasingInFileNames": true,
      "skipLibCheck": true,
      "types": ["vitest/globals"]
    },
    "include": ["src"]
  }
  ```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`** (enable globals so tests can use `describe/it/expect` without imports; node env). Full contents:
  ```ts
  import { defineConfig } from "vitest/config";

  export default defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  });
  ```

- [ ] **Step 4: Install the shared package deps from the repo root** (workspace-aware). Run:
  ```bash
  pnpm install
  ```
  Expected: install completes with `Done in ...`; `viem`, `bs58`, and `vitest` appear under `packages/shared`. Verify the binary resolves:
  ```bash
  pnpm --filter @aeonomy/shared exec vitest --version
  ```
  Expected output: a version string like `2.1.x` (vitest) — confirms the dep graph is wired.

- [ ] **Step 5: Commit.** Run:
  ```bash
  git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts pnpm-lock.yaml
  git commit -m "chore(shared): scaffold @aeonomy/shared package (viem, bs58, vitest)"
  ```
  Expected output: a commit summary listing the 4 files.

---

### Task 4: `addresses.ts` (verified addresses + chain config) and `abi.ts` (AgentRegistry ABI)

**Files:**
- Create: `packages/shared/src/addresses.ts`
- Create: `packages/shared/src/abi.ts`

- [ ] **Step 1: Create `packages/shared/src/addresses.ts`** with the EXACT verified addresses from the shared interface and Base Sepolia chain config. Full contents:
  ```ts
  import type { Address } from "viem";
  import { baseSepolia } from "viem/chains";

  /** Base Sepolia is the ONLY supported network for slice 1. */
  export const CHAIN = baseSepolia;
  export const CHAIN_ID = 84532 as const;

  /** Verified contract addresses (Base Sepolia; also valid on mainnet). */
  export const ADDRESSES = {
    /** Alchemy LightAccountFactory v2.0.0 */
    lightAccountFactory: "0x0000000000400CdFef5E2714E63d8040b700BC24" as Address,
    /** LightAccount v2.0.0 implementation */
    lightAccountImpl: "0x8E8e658E22B12ada97B402fF0b044D6A325013C7" as Address,
    /** EntryPoint v0.7 */
    entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address,
    /** USDC (Base Sepolia) */
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
  } as const;

  /**
   * AgentRegistry address is deployment-specific. Reads from NEXT_PUBLIC_REGISTRY_ADDRESS
   * (browser/web) or REGISTRY_ADDRESS (node/indexer). Returns undefined if unset.
   */
  export function getRegistryAddress(): Address | undefined {
    const v =
      (typeof process !== "undefined" &&
        (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
          process.env.REGISTRY_ADDRESS)) ||
      undefined;
    return v ? (v as Address) : undefined;
  }
  ```

- [ ] **Step 2: Create `packages/shared/src/abi.ts`** with the AgentRegistry ABI matching the contract interface verbatim (struct `Agent`, event `AgentSpawned`, errors `HandleTaken`/`InvalidHandle`, public `totalAgents`/`factory`, and all functions). Full contents:
  ```ts
  /**
   * AgentRegistry ABI — must match packages/contracts/src/AgentRegistry.sol verbatim.
   * The Agent struct is exposed as a tuple in getAgentByHandle/getAgentById.
   */
  export const agentRegistryAbi = [
    {
      type: "constructor",
      stateMutability: "nonpayable",
      inputs: [{ name: "factory_", type: "address" }],
    },
    {
      type: "function",
      name: "factory",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "address" }],
    },
    {
      type: "function",
      name: "totalAgents",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      type: "function",
      name: "spawnAgent",
      stateMutability: "nonpayable",
      inputs: [
        { name: "handle", type: "string" },
        { name: "manifestHash", type: "bytes32" },
        { name: "configHash", type: "bytes32" },
      ],
      outputs: [
        { name: "agentId", type: "uint256" },
        { name: "wallet", type: "address" },
      ],
    },
    {
      type: "function",
      name: "getAgentByHandle",
      stateMutability: "view",
      inputs: [{ name: "handle", type: "string" }],
      outputs: [
        {
          name: "",
          type: "tuple",
          components: [
            { name: "owner", type: "address" },
            { name: "wallet", type: "address" },
            { name: "manifestHash", type: "bytes32" },
            { name: "configHash", type: "bytes32" },
            { name: "handle", type: "string" },
            { name: "createdAt", type: "uint64" },
          ],
        },
      ],
    },
    {
      type: "function",
      name: "getAgentById",
      stateMutability: "view",
      inputs: [{ name: "agentId", type: "uint256" }],
      outputs: [
        {
          name: "",
          type: "tuple",
          components: [
            { name: "owner", type: "address" },
            { name: "wallet", type: "address" },
            { name: "manifestHash", type: "bytes32" },
            { name: "configHash", type: "bytes32" },
            { name: "handle", type: "string" },
            { name: "createdAt", type: "uint64" },
          ],
        },
      ],
    },
    {
      type: "function",
      name: "isHandleAvailable",
      stateMutability: "view",
      inputs: [{ name: "handle", type: "string" }],
      outputs: [{ name: "", type: "bool" }],
    },
    {
      type: "event",
      name: "AgentSpawned",
      inputs: [
        { name: "agentId", type: "uint256", indexed: true },
        { name: "owner", type: "address", indexed: true },
        { name: "wallet", type: "address", indexed: false },
        { name: "handle", type: "string", indexed: false },
        { name: "manifestHash", type: "bytes32", indexed: false },
        { name: "configHash", type: "bytes32", indexed: false },
      ],
      anonymous: false,
    },
    {
      type: "error",
      name: "HandleTaken",
      inputs: [],
    },
    {
      type: "error",
      name: "InvalidHandle",
      inputs: [],
    },
  ] as const;

  /** Minimal LightAccountFactory ABI: only getAddress(owner, salt) is needed (view). */
  export const lightAccountFactoryAbi = [
    {
      type: "function",
      name: "getAddress",
      stateMutability: "view",
      inputs: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
      ],
      outputs: [{ name: "", type: "address" }],
    },
  ] as const;
  ```

- [ ] **Step 3: Commit.** Run:
  ```bash
  git add packages/shared/src/addresses.ts packages/shared/src/abi.ts
  git commit -m "feat(shared): add verified addresses, chain config, and AgentRegistry ABI"
  ```
  Expected output: a commit summary listing the 2 files.

---

### Task 5: `types.ts` (Manifest/Persona/Skill/AgentSummary/AgentDetail)

**Files:**
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Create `packages/shared/src/types.ts`** with the EXACT types from the shared interface. Full contents:
  ```ts
  import type { Address, Hex } from "viem";

  /** 0x-prefixed 32-byte hash. */
  export type Bytes32 = Hex;

  export type Persona = {
    displayName: string;
    bio: string;
    avatarSeed: string;
  };

  export type Manifest = {
    version: 1;
    handle: string;
    owner: Address;
    persona: Persona;
    skills: string[];
    createdAt: number;
  };

  export type Skill = {
    slug: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
  };

  export type AgentSummary = {
    agentId: number;
    handle: string;
    owner: Address;
    wallet: Address;
    skills: string[];
    createdAt: number;
  };

  export type AgentDetail = AgentSummary & {
    manifestHash: Bytes32;
    manifestCid: string;
    configHash: Bytes32;
    persona: Persona;
  };

  /** On-chain Agent struct mirror (tuple from getAgentByHandle/getAgentById). */
  export type Agent = {
    owner: Address;
    wallet: Address;
    manifestHash: Bytes32;
    configHash: Bytes32;
    handle: string;
    createdAt: bigint;
  };
  ```

- [ ] **Step 2: Commit.** Run:
  ```bash
  git add packages/shared/src/types.ts
  git commit -m "feat(shared): add Manifest/Persona/Skill/AgentSummary/AgentDetail types"
  ```
  Expected output: a commit summary listing the 1 file.

---

### Task 6: `helpers.ts` deterministic functions — TDD

This task writes the failing tests FIRST (round-trip + salt determinism), confirms they fail, then implements the helpers, then confirms green.

**Files:**
- Create: `packages/shared/src/helpers.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/helpers.test.ts`

- [ ] **Step 1: Write the failing test file `packages/shared/src/helpers.test.ts`.** Full contents (covers `cidToBytes32` <-> `bytes32ToCidV0` round-trip, a known-vector CID, `computeSalt` determinism + Solidity equivalence via `keccak256(encodeAbiParameters(...))`, and `computeConfigHash` determinism):
  ```ts
  import { describe, it, expect } from "vitest";
  import {
    keccak256,
    encodeAbiParameters,
    toHex,
    type Address,
  } from "viem";
  import {
    cidToBytes32,
    bytes32ToCidV0,
    computeSalt,
    computeConfigHash,
    buildManifest,
  } from "./helpers";

  // A real CIDv0 (sha2-256 multihash, base58btc). The "empty directory" CID.
  const KNOWN_CID = "QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn";

  describe("cidToBytes32 <-> bytes32ToCidV0", () => {
    it("round-trips a known CIDv0", () => {
      const h = cidToBytes32(KNOWN_CID);
      expect(h).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(bytes32ToCidV0(h)).toBe(KNOWN_CID);
    });

    it("round-trips arbitrary 32-byte digests", () => {
      const digest =
        "0x1111111111111111111111111111111111111111111111111111111111111111";
      const cid = bytes32ToCidV0(digest);
      expect(cid.startsWith("Qm")).toBe(true);
      expect(cidToBytes32(cid).toLowerCase()).toBe(digest);
    });
  });

  describe("computeSalt", () => {
    const owner = "0x1234567890123456789012345678901234567890" as Address;

    it("is deterministic for the same (owner, handle)", () => {
      expect(computeSalt(owner, "alpha")).toBe(computeSalt(owner, "alpha"));
    });

    it("differs across handles", () => {
      expect(computeSalt(owner, "alpha")).not.toBe(computeSalt(owner, "beta"));
    });

    it("matches Solidity keccak256(abi.encode(owner, handle))", () => {
      const expected = BigInt(
        keccak256(
          encodeAbiParameters(
            [{ type: "address" }, { type: "string" }],
            [owner, "alpha"],
          ),
        ),
      );
      expect(computeSalt(owner, "alpha")).toBe(expected);
    });
  });

  describe("computeConfigHash", () => {
    it("is deterministic regardless of key insertion order", () => {
      const a = computeConfigHash({ b: 2, a: 1 });
      const b = computeConfigHash({ a: 1, b: 2 });
      expect(a).toBe(b);
      expect(a).toBe(keccak256(toHex(JSON.stringify({ a: 1, b: 2 }))));
    });
  });

  describe("buildManifest", () => {
    it("builds a versioned manifest with provided fields", () => {
      const owner = "0x1234567890123456789012345678901234567890" as Address;
      const m = buildManifest({
        handle: "alpha",
        owner,
        persona: { displayName: "Alpha", bio: "hi", avatarSeed: "seed-1" },
        skills: ["summarize"],
        createdAt: 1718000000,
      });
      expect(m.version).toBe(1);
      expect(m.handle).toBe("alpha");
      expect(m.owner).toBe(owner);
      expect(m.skills).toEqual(["summarize"]);
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm it FAILS** (helpers/index do not exist yet). Run:
  ```bash
  pnpm --filter @aeonomy/shared test
  ```
  Expected: Vitest fails to resolve the import, printing something like `Failed to load url ./helpers` / `Cannot find module './helpers'` and `Test Files  1 failed`. This confirms the test is wired and red.

- [ ] **Step 3: Implement `packages/shared/src/helpers.ts`** with FULL contents. `computeSalt` mirrors `keccak256(abi.encode(msg.sender, handle))`; `computeConfigHash` hashes the canonical (sorted-key) JSON string; `cidToBytes32`/`bytes32ToCidV0` handle the `0x12 0x20` sha2-256 multihash prefix; `predictWallet` reads `factory.getAddress`; `buildManifest` assembles the typed manifest:
  ```ts
  import bs58 from "bs58";
  import {
    keccak256,
    encodeAbiParameters,
    toHex,
    type Address,
    type Hex,
    type PublicClient,
  } from "viem";
  import { ADDRESSES } from "./addresses";
  import { lightAccountFactoryAbi } from "./abi";
  import type { Manifest, Persona } from "./types";

  /**
   * salt = uint256(keccak256(abi.encode(owner, handle))) — matches AgentRegistry.sol.
   * NOTE: the contract computes salt from msg.sender; clients must pass the same owner.
   */
  export function computeSalt(owner: Address, handle: string): bigint {
    return BigInt(
      keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "string" }],
          [owner, handle],
        ),
      ),
    );
  }

  /** Recursively sort object keys to produce a canonical, stable JSON string. */
  function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        out[key] = canonicalize(obj[key]);
      }
      return out;
    }
    return value;
  }

  /**
   * keccak256 of the canonical JSON string of `config`.
   * Canonical = recursively key-sorted, so logically-equal configs hash equally.
   */
  export function computeConfigHash(config: object): Hex {
    return keccak256(toHex(JSON.stringify(canonicalize(config))));
  }

  /**
   * CIDv0 (base58btc sha2-256 multihash) -> 32-byte digest as 0x hex.
   * Decoded bytes are [0x12, 0x20, ...32 digest bytes]; strip the 2-byte prefix.
   */
  export function cidToBytes32(cidV0: string): Hex {
    const bytes = bs58.decode(cidV0);
    if (bytes.length !== 34 || bytes[0] !== 0x12 || bytes[1] !== 0x20) {
      throw new Error(`Not a sha2-256 CIDv0: ${cidV0}`);
    }
    const digest = bytes.slice(2);
    return ("0x" +
      Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join(
        "",
      )) as Hex;
  }

  /**
   * 32-byte digest (0x hex) -> CIDv0 by prepending the sha2-256 multihash prefix
   * [0x12, 0x20] and base58btc-encoding the 34 bytes.
   */
  export function bytes32ToCidV0(h: Hex): string {
    const hex = h.startsWith("0x") ? h.slice(2) : h;
    if (hex.length !== 64) {
      throw new Error(`Expected 32-byte hex, got length ${hex.length}`);
    }
    const digest = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      digest[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    const full = new Uint8Array(34);
    full[0] = 0x12;
    full[1] = 0x20;
    full.set(digest, 2);
    return bs58.encode(full);
  }

  /**
   * Predicts the counterfactual LightAccount wallet for (owner, handle):
   * factory.getAddress(owner, computeSalt(owner, handle)). Wallet is NOT deployed in slice 1.
   */
  export async function predictWallet(
    publicClient: PublicClient,
    owner: Address,
    handle: string,
  ): Promise<Address> {
    return (await publicClient.readContract({
      address: ADDRESSES.lightAccountFactory,
      abi: lightAccountFactoryAbi,
      functionName: "getAddress",
      args: [owner, computeSalt(owner, handle)],
    })) as Address;
  }

  /** Assemble a version-1 Manifest from its parts. */
  export function buildManifest(input: {
    handle: string;
    owner: Address;
    persona: Persona;
    skills: string[];
    createdAt: number;
  }): Manifest {
    return {
      version: 1,
      handle: input.handle,
      owner: input.owner,
      persona: input.persona,
      skills: input.skills,
      createdAt: input.createdAt,
    };
  }
  ```

- [ ] **Step 4: Create the package barrel `packages/shared/src/index.ts`** re-exporting all public surface. Full contents:
  ```ts
  export * from "./addresses";
  export * from "./abi";
  export * from "./types";
  export * from "./helpers";
  ```

- [ ] **Step 5: Run the test and confirm it PASSES.** Run:
  ```bash
  pnpm --filter @aeonomy/shared test
  ```
  Expected: `Test Files  1 passed (1)` and `Tests  ...  passed` covering the round-trip, salt determinism, Solidity-equivalence, config-hash, and buildManifest cases.

- [ ] **Step 6: Typecheck the package.** Run:
  ```bash
  pnpm --filter @aeonomy/shared typecheck
  ```
  Expected: `tsc --noEmit` exits 0 with no output.

- [ ] **Step 7: Commit.** Run:
  ```bash
  git add packages/shared/src/helpers.ts packages/shared/src/index.ts packages/shared/src/helpers.test.ts
  git commit -m "feat(shared): deterministic helpers (salt, configHash, cid<->bytes32, buildManifest) with tests"
  ```
  Expected output: a commit summary listing the 3 files.

---

### Task 7: Workspace-level `pnpm -w test` green gate

**Files:**
- Modify: (none — verification + commit only)

- [ ] **Step 1: Run the full workspace test from the repo root.** Run:
  ```bash
  pnpm -w test
  ```
  Expected: pnpm fans out recursively; only `@aeonomy/shared` has a `test` script in this phase, so output shows its Vitest run ending in `Test Files  1 passed (1)` and the overall command exits 0. (Other packages have no `test` script yet and are skipped via `--if-present`.)

- [ ] **Step 2: Run the full workspace typecheck.** Run:
  ```bash
  pnpm -w typecheck
  ```
  Expected: `@aeonomy/shared` typechecks clean (exit 0); other packages skipped.

- [ ] **Step 3: Confirm a clean working tree.** Run:
  ```bash
  git status --short
  ```
  Expected: empty output (everything committed). If anything is untracked/modified, commit it before proceeding:
  ```bash
  git add -A
  git commit -m "chore: phase 0 cleanup"
  ```

Phase 0 is complete: the workspace globs include `packages/contracts` (ready for Phase 1's `forge init`), `packages/shared`, `apps/web`, and `apps/indexer`; Postgres 16 runs the exact slice-1 DDL; and `pnpm -w test` is green on the shared package's deterministic helpers.

## Phase 1: AgentRegistry contract (Foundry)

This phase scaffolds the `packages/contracts/` Foundry project, writes the full Foundry test suite FIRST (with a `MockLightAccountFactory`), then implements `src/AgentRegistry.sol` to match the SHARED INTERFACE verbatim (contract-computed salt), adds `script/Deploy.s.sol` wired to the real LightAccountFactory address, and finishes by recording the deployed address + deploy block into the `apps/web` and `apps/indexer` env files. All commits are made from the repo root so the monorepo history stays linear.

Assumptions for this phase (verified locally): `forge 1.7.x` is installed, `cast` is available, and the repo root is a git repo (`git init` already run for the monorepo). All paths below are relative to the repo root unless stated otherwise.

---

### Task 8: Scaffold the Foundry project inside packages/contracts

**Files:**
- Create: `packages/contracts/foundry.toml`
- Create: `packages/contracts/.gitignore`
- Create: `packages/contracts/.env.example`
- Create: `packages/contracts/remappings.txt`
- Modify (created by forge): `packages/contracts/lib/forge-std/**`

- [ ] **Step 1: Create the package directory and init Foundry without committing.** Run from repo root:
  ```bash
  mkdir -p packages/contracts
  forge init packages/contracts --no-commit --no-git
  ```
  Expected: forge prints `Initialized forge project` and creates `packages/contracts/src/Counter.sol`, `packages/contracts/test/Counter.t.sol`, `packages/contracts/script/Counter.s.sol`, and `packages/contracts/lib/forge-std`. (`--no-git` keeps the monorepo's single git repo; `--no-commit` skips a contracts-only commit.)

- [ ] **Step 2: Remove the template files we will not use.** Run from repo root:
  ```bash
  rm packages/contracts/src/Counter.sol packages/contracts/test/Counter.t.sol packages/contracts/script/Counter.s.sol
  ```
  Expected: no output. `ls packages/contracts/src packages/contracts/test packages/contracts/script` now shows empty directories.

- [ ] **Step 3: Write `packages/contracts/foundry.toml`** pinning solc 0.8.24, remappings, the Base Sepolia RPC endpoint (read from env), and the etherscan config for `--verify`. FULL contents:
  ```toml
  [profile.default]
  src = "src"
  out = "out"
  libs = ["lib"]
  test = "test"
  script = "script"
  solc = "0.8.24"
  optimizer = true
  optimizer_runs = 200
  evm_version = "cancun"
  remappings = ["forge-std/=lib/forge-std/src/"]

  [rpc_endpoints]
  base_sepolia = "${BASE_SEPOLIA_RPC_URL}"

  [etherscan]
  base_sepolia = { key = "${ETHERSCAN_API_KEY}", chain = 84532, url = "https://api-sepolia.basescan.org/api" }

  [fmt]
  line_length = 100
  tab_width = 4
  bracket_spacing = true
  ```

- [ ] **Step 4: Write `packages/contracts/remappings.txt`** (explicit file so editors/tooling resolve `forge-std`). FULL contents:
  ```
  forge-std/=lib/forge-std/src/
  ```

- [ ] **Step 5: Write `packages/contracts/.gitignore`.** FULL contents:
  ```
  cache/
  out/
  broadcast/
  .env
  ```

- [ ] **Step 6: Write `packages/contracts/.env.example`** documenting the env this package needs. FULL contents:
  ```
  # RPC for Base Sepolia (chainId 84532)
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
  # Private key used ONLY for deploying contracts
  DEPLOYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
  # Basescan API key for forge verify (etherscan-compatible)
  ETHERSCAN_API_KEY=your_basescan_api_key
  ```

- [ ] **Step 7: Confirm the toolchain compiles the (empty) project.** Run from repo root:
  ```bash
  forge build --root packages/contracts
  ```
  Expected: `Nothing to compile` (no sources yet) — confirms `foundry.toml` parses and `solc 0.8.24` is resolvable. If solc is missing forge auto-downloads it; the command still exits 0.

- [ ] **Step 8: Commit the scaffold.** Run from repo root:
  ```bash
  git add packages/contracts/foundry.toml packages/contracts/remappings.txt packages/contracts/.gitignore packages/contracts/.env.example packages/contracts/lib packages/contracts/.gitmodules
  git commit -m "chore(contracts): scaffold Foundry project for AgentRegistry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds. (If `forge init` vendored `lib/forge-std` as a submodule it created `.gitmodules`; if it copied files instead, drop `.gitmodules` from the `git add` line — `git status` will tell you which.)

---

### Task 9: Write the MockLightAccountFactory test helper and the AgentRegistry test suite (FAILING FIRST)

We write tests before any production contract exists. The suite uses a deterministic `MockLightAccountFactory` whose `getAddress(owner, salt)` returns `address(uint160(uint256(keccak256(abi.encode(owner, salt)))))` so we can assert the registry passes the contract-computed salt through unchanged.

**Files:**
- Create (Test helper): `packages/contracts/test/mocks/MockLightAccountFactory.sol`
- Create (Test): `packages/contracts/test/AgentRegistry.t.sol`

- [ ] **Step 1: Write the mock factory `packages/contracts/test/mocks/MockLightAccountFactory.sol`.** It implements the same `getAddress(address,uint256)` signature the registry depends on, deterministically. FULL contents:
  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  /// @notice Test double for LightAccountFactory v2.0.0 `getAddress`.
  /// Deterministic so tests can recompute the expected wallet independently.
  contract MockLightAccountFactory {
      function getAddress(address owner, uint256 salt) external pure returns (address) {
          return address(uint160(uint256(keccak256(abi.encode(owner, salt)))));
      }
  }
  ```

- [ ] **Step 2: Write the test suite `packages/contracts/test/AgentRegistry.t.sol`.** It imports a not-yet-existing `AgentRegistry` (so the build fails first), the mock, and forge-std. It covers: spawn happy path (agentId==1, wallet matches factory.getAddress with the contract-computed salt), `AgentSpawned` event via `vm.expectEmit`, `HandleTaken` revert, four `InvalidHandle` reverts (too short, too long, uppercase, illegal char), `isHandleAvailable` true/false, and `getAgentByHandle`/`getAgentById` stored data. FULL contents:
  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import {Test} from "forge-std/Test.sol";
  import {AgentRegistry} from "../src/AgentRegistry.sol";
  import {MockLightAccountFactory} from "./mocks/MockLightAccountFactory.sol";

  contract AgentRegistryTest is Test {
      AgentRegistry internal registry;
      MockLightAccountFactory internal factory;

      address internal owner = address(0xABCD);

      bytes32 internal constant MANIFEST_HASH =
          0x1111111111111111111111111111111111111111111111111111111111111111;
      bytes32 internal constant CONFIG_HASH =
          0x2222222222222222222222222222222222222222222222222222222222222222;

      // Mirror of the event in AgentRegistry for vm.expectEmit.
      event AgentSpawned(
          uint256 indexed agentId,
          address indexed owner,
          address wallet,
          string handle,
          bytes32 manifestHash,
          bytes32 configHash
      );

      function setUp() public {
          factory = new MockLightAccountFactory();
          registry = new AgentRegistry(address(factory));
      }

      // Recompute the salt exactly as the contract must: keccak256(abi.encode(msg.sender, handle)).
      function _expectedWallet(address owner_, string memory handle) internal view returns (address) {
          uint256 salt = uint256(keccak256(abi.encode(owner_, handle)));
          return factory.getAddress(owner_, salt);
      }

      function test_SpawnHappyPath_ReturnsIdAndCounterfactualWallet() public {
          string memory handle = "alice";
          address expectedWallet = _expectedWallet(owner, handle);

          vm.prank(owner);
          (uint256 agentId, address wallet) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

          assertEq(agentId, 1, "first agentId must be 1");
          assertEq(wallet, expectedWallet, "wallet must equal factory.getAddress(owner, salt)");
          assertEq(registry.totalAgents(), 1, "totalAgents must increment to 1");
      }

      function test_SpawnEmitsAgentSpawned() public {
          string memory handle = "alice";
          address expectedWallet = _expectedWallet(owner, handle);

          // Check all topics + data. agentId=1, owner indexed.
          vm.expectEmit(true, true, false, true, address(registry));
          emit AgentSpawned(1, owner, expectedWallet, handle, MANIFEST_HASH, CONFIG_HASH);

          vm.prank(owner);
          registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
      }

      function test_SpawnStoresAgent_ByHandleAndById() public {
          string memory handle = "alice";
          address expectedWallet = _expectedWallet(owner, handle);

          vm.prank(owner);
          (uint256 agentId,) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

          AgentRegistry.Agent memory byHandle = registry.getAgentByHandle(handle);
          AgentRegistry.Agent memory byId = registry.getAgentById(agentId);

          assertEq(byHandle.owner, owner);
          assertEq(byHandle.wallet, expectedWallet);
          assertEq(byHandle.manifestHash, MANIFEST_HASH);
          assertEq(byHandle.configHash, CONFIG_HASH);
          assertEq(byHandle.handle, handle);
          assertEq(uint256(byHandle.createdAt), uint256(uint64(block.timestamp)));

          // Same struct retrievable by id.
          assertEq(byId.owner, byHandle.owner);
          assertEq(byId.wallet, byHandle.wallet);
          assertEq(byId.handle, byHandle.handle);
          assertEq(byId.manifestHash, byHandle.manifestHash);
          assertEq(byId.configHash, byHandle.configHash);
          assertEq(uint256(byId.createdAt), uint256(byHandle.createdAt));
      }

      function test_RevertWhen_HandleTaken() public {
          string memory handle = "alice";

          vm.prank(owner);
          registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

          // Even a different owner cannot reuse the handle.
          vm.prank(address(0xBEEF));
          vm.expectRevert(AgentRegistry.HandleTaken.selector);
          registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
      }

      function test_RevertWhen_HandleTooShort() public {
          vm.prank(owner);
          vm.expectRevert(AgentRegistry.InvalidHandle.selector);
          registry.spawnAgent("ab", MANIFEST_HASH, CONFIG_HASH);
      }

      function test_RevertWhen_HandleTooLong() public {
          // 33 bytes (max is 32).
          string memory tooLong = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
          assertEq(bytes(tooLong).length, 33);
          vm.prank(owner);
          vm.expectRevert(AgentRegistry.InvalidHandle.selector);
          registry.spawnAgent(tooLong, MANIFEST_HASH, CONFIG_HASH);
      }

      function test_RevertWhen_HandleHasUppercase() public {
          vm.prank(owner);
          vm.expectRevert(AgentRegistry.InvalidHandle.selector);
          registry.spawnAgent("Alice", MANIFEST_HASH, CONFIG_HASH);
      }

      function test_RevertWhen_HandleHasIllegalChar() public {
          // underscore (0x5f) is not allowed; only [a-z],[0-9],'-'.
          vm.prank(owner);
          vm.expectRevert(AgentRegistry.InvalidHandle.selector);
          registry.spawnAgent("al_ce", MANIFEST_HASH, CONFIG_HASH);
      }

      function test_HandleWithDigitsAndHyphen_IsValid() public {
          string memory handle = "a-1-9";
          vm.prank(owner);
          (uint256 agentId,) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
          assertEq(agentId, 1);
      }

      function test_IsHandleAvailable_TrueForFreeValid_FalseForTakenAndInvalid() public {
          assertTrue(registry.isHandleAvailable("alice"), "free valid handle is available");
          assertFalse(registry.isHandleAvailable("ab"), "too short is unavailable");
          assertFalse(registry.isHandleAvailable("Alice"), "uppercase is unavailable");
          assertFalse(registry.isHandleAvailable("al_ce"), "illegal char is unavailable");

          vm.prank(owner);
          registry.spawnAgent("alice", MANIFEST_HASH, CONFIG_HASH);
          assertFalse(registry.isHandleAvailable("alice"), "taken handle is unavailable");
      }

      function test_AgentIdsIncrement_AcrossSpawns() public {
          vm.prank(owner);
          (uint256 id1,) = registry.spawnAgent("alice", MANIFEST_HASH, CONFIG_HASH);
          vm.prank(owner);
          (uint256 id2,) = registry.spawnAgent("bob", MANIFEST_HASH, CONFIG_HASH);
          assertEq(id1, 1);
          assertEq(id2, 2);
          assertEq(registry.totalAgents(), 2);
      }
  }
  ```

- [ ] **Step 3: Run the tests and confirm they FAIL to compile (no `AgentRegistry` yet).** Run from repo root:
  ```bash
  forge test --root packages/contracts -vvv
  ```
  Expected FAIL: a compiler error such as:
  ```
  Error (6275): Source "src/AgentRegistry.sol" not found: File not found.
   --> test/AgentRegistry.t.sol
  ```
  (The build cannot resolve `../src/AgentRegistry.sol`. This is the expected red state — no tests run yet.)

- [ ] **Step 4: Commit the failing tests + mock.** Run from repo root:
  ```bash
  git add packages/contracts/test/mocks/MockLightAccountFactory.sol packages/contracts/test/AgentRegistry.t.sol
  git commit -m "test(contracts): add failing AgentRegistry suite + mock factory

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds.

---

### Task 10: Implement AgentRegistry.sol to pass the suite

Implement the contract exactly per the SHARED INTERFACE: contract-computed salt `keccak256(abi.encode(msg.sender, handle))`, counterfactual wallet from `factory.getAddress`, handle validation `_validateHandle` (internal pure, bytes length 3..32, each byte `[a-z]`/`[0-9]`/`-`), uniqueness keyed by `keccak256(bytes(handle))`, `agentId = ++totalAgents`, `createdAt = uint64(block.timestamp)`, and the `AgentSpawned` event.

**Files:**
- Create: `packages/contracts/src/AgentRegistry.sol`

- [ ] **Step 1: Write `packages/contracts/src/AgentRegistry.sol`.** FULL contents:
  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  interface ILightAccountFactory {
      function getAddress(address owner, uint256 salt) external view returns (address);
  }

  /// @title AgentRegistry
  /// @notice Registers AI agents with unique handles and a counterfactual LightAccount wallet.
  ///         The smart-account wallet is NOT deployed here; its address is predicted via the
  ///         LightAccountFactory's view `getAddress` (CREATE2 counterfactual address).
  contract AgentRegistry {
      struct Agent {
          address owner;
          address wallet;
          bytes32 manifestHash;
          bytes32 configHash;
          string handle;
          uint64 createdAt;
      }

      event AgentSpawned(
          uint256 indexed agentId,
          address indexed owner,
          address wallet,
          string handle,
          bytes32 manifestHash,
          bytes32 configHash
      );

      error HandleTaken();
      error InvalidHandle();

      ILightAccountFactory public immutable factory;

      /// @dev Also the id of the last spawned agent; ids start at 1.
      uint256 public totalAgents;

      mapping(uint256 => Agent) internal _agentsById;
      mapping(bytes32 => uint256) internal _agentIdByHandleHash;

      constructor(address factory_) {
          factory = ILightAccountFactory(factory_);
      }

      function spawnAgent(string calldata handle, bytes32 manifestHash, bytes32 configHash)
          external
          returns (uint256 agentId, address wallet)
      {
          if (!_validateHandle(handle)) revert InvalidHandle();

          bytes32 handleHash = keccak256(bytes(handle));
          if (_agentIdByHandleHash[handleHash] != 0) revert HandleTaken();

          uint256 salt = uint256(keccak256(abi.encode(msg.sender, handle)));
          wallet = factory.getAddress(msg.sender, salt);

          agentId = ++totalAgents;

          _agentsById[agentId] = Agent({
              owner: msg.sender,
              wallet: wallet,
              manifestHash: manifestHash,
              configHash: configHash,
              handle: handle,
              createdAt: uint64(block.timestamp)
          });
          _agentIdByHandleHash[handleHash] = agentId;

          emit AgentSpawned(agentId, msg.sender, wallet, handle, manifestHash, configHash);
      }

      function getAgentByHandle(string calldata handle) external view returns (Agent memory) {
          return _agentsById[_agentIdByHandleHash[keccak256(bytes(handle))]];
      }

      function getAgentById(uint256 agentId) external view returns (Agent memory) {
          return _agentsById[agentId];
      }

      /// @notice False for invalid format OR already-taken handles.
      function isHandleAvailable(string calldata handle) external view returns (bool) {
          if (!_validateHandle(handle)) return false;
          return _agentIdByHandleHash[keccak256(bytes(handle))] == 0;
      }

      /// @dev bytes length 3..32; each byte in [a-z], [0-9], or '-' (0x2d). Lowercase only.
      function _validateHandle(string calldata handle) internal pure returns (bool) {
          bytes calldata b = bytes(handle);
          uint256 len = b.length;
          if (len < 3 || len > 32) return false;
          for (uint256 i = 0; i < len; i++) {
              bytes1 c = b[i];
              bool isLower = c >= 0x61 && c <= 0x7a; // a-z
              bool isDigit = c >= 0x30 && c <= 0x39; // 0-9
              bool isHyphen = c == 0x2d; // '-'
              if (!isLower && !isDigit && !isHyphen) return false;
          }
          return true;
      }
  }
  ```

- [ ] **Step 2: Run the full suite and confirm it PASSES.** Run from repo root:
  ```bash
  forge test --root packages/contracts -vvv
  ```
  Expected PASS: all 11 tests green, e.g.:
  ```
  Ran 11 tests for test/AgentRegistry.t.sol:AgentRegistryTest
  [PASS] test_AgentIdsIncrement_AcrossSpawns() (gas: ...)
  [PASS] test_HandleWithDigitsAndHyphen_IsValid() (gas: ...)
  [PASS] test_HandleTooLong... [PASS] test_IsHandleAvailable_... [PASS] test_RevertWhen_HandleTaken()
  [PASS] test_SpawnEmitsAgentSpawned() (gas: ...)
  [PASS] test_SpawnHappyPath_ReturnsIdAndCounterfactualWallet() (gas: ...)
  [PASS] test_SpawnStoresAgent_ByHandleAndById() (gas: ...)
  ...
  Suite result: ok. 11 passed; 0 failed; 0 skipped
  ```

- [ ] **Step 3: Commit the implementation.** Run from repo root:
  ```bash
  git add packages/contracts/src/AgentRegistry.sol
  git commit -m "feat(contracts): implement AgentRegistry with contract-computed salt

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds.

---

### Task 11: Add the deploy script wired to the real LightAccountFactory

`script/Deploy.s.sol` deploys `AgentRegistry` with the verified `LightAccountFactory v2.0.0` address `0x0000000000400CdFef5E2714E63d8040b700BC24`, then logs the deployed registry address and the deploy block so they can be copied into env files (Task 13).

**Files:**
- Create: `packages/contracts/script/Deploy.s.sol`

- [ ] **Step 1: Write `packages/contracts/script/Deploy.s.sol`.** FULL contents:
  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import {Script, console2} from "forge-std/Script.sol";
  import {AgentRegistry} from "../src/AgentRegistry.sol";

  contract Deploy is Script {
      // Verified LightAccountFactory v2.0.0 (Base Sepolia + mainnet).
      address internal constant LIGHT_ACCOUNT_FACTORY = 0x0000000000400CdFef5E2714E63d8040b700BC24;

      function run() external returns (AgentRegistry registry) {
          uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

          vm.startBroadcast(deployerKey);
          registry = new AgentRegistry(LIGHT_ACCOUNT_FACTORY);
          vm.stopBroadcast();

          console2.log("AgentRegistry deployed at:", address(registry));
          console2.log("Deploy block (DEPLOY_BLOCK):", block.number);
          console2.log("LightAccountFactory used:", LIGHT_ACCOUNT_FACTORY);
      }
  }
  ```

- [ ] **Step 2: Confirm the script compiles (dry, no broadcast, no RPC).** Run from repo root:
  ```bash
  forge build --root packages/contracts
  ```
  Expected: `Compiling ...` then `Compiler run successful!` (or `No files changed, compilation skipped` if cached). No errors.

- [ ] **Step 3: Run the deploy script in simulation against a local-key + fork to prove it executes** (optional but recommended before spending gas). Requires `BASE_SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in `packages/contracts/.env`. Run from repo root:
  ```bash
  forge script script/Deploy.s.sol:Deploy \
    --root packages/contracts \
    --rpc-url base_sepolia
  ```
  Expected: a simulation summary ending with `Script ran successfully.` and the three `console2.log` lines (registry address, deploy block, factory). No `--broadcast` here means nothing is sent on-chain. (Loads `.env` automatically via Foundry's dotenv support; if not, prefix with `source packages/contracts/.env &&`.)

- [ ] **Step 4: Commit the deploy script.** Run from repo root:
  ```bash
  git add packages/contracts/script/Deploy.s.sol
  git commit -m "feat(contracts): add Deploy script wired to LightAccountFactory v2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds.

---

### Task 12: Fork-test the LightAccountFactory.getAddress integration against Base Sepolia

The unit suite uses a mock. This task adds an opt-in fork test that asserts the real on-chain `LightAccountFactory.getAddress` returns a valid (non-zero) counterfactual wallet for the contract-computed salt, validating the integration boundary. It is skipped automatically when no fork URL is configured so CI without RPC stays green.

**Files:**
- Create (Test): `packages/contracts/test/AgentRegistryFork.t.sol`

- [ ] **Step 1: Write `packages/contracts/test/AgentRegistryFork.t.sol`.** It creates a Base Sepolia fork from `BASE_SEPOLIA_RPC_URL`, deploys `AgentRegistry` against the REAL factory, spawns an agent, and checks the returned wallet is non-zero and equals an independent recomputation via the real factory. FULL contents:
  ```solidity
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;

  import {Test} from "forge-std/Test.sol";
  import {AgentRegistry, ILightAccountFactory} from "../src/AgentRegistry.sol";

  /// @dev Opt-in integration test. Runs only when BASE_SEPOLIA_RPC_URL is set,
  ///      i.e. when invoked with `--fork-url base_sepolia` or with the env var present.
  contract AgentRegistryForkTest is Test {
      address internal constant LIGHT_ACCOUNT_FACTORY = 0x0000000000400CdFef5E2714E63d8040b700BC24;

      AgentRegistry internal registry;
      bool internal forked;

      function setUp() public {
          string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
          if (bytes(rpc).length == 0) {
              forked = false;
              return;
          }
          vm.createSelectFork(rpc);
          registry = new AgentRegistry(LIGHT_ACCOUNT_FACTORY);
          forked = true;
      }

      function test_RealFactory_ReturnsCounterfactualWallet() public {
          if (!forked) {
              emit log("skipping fork test: BASE_SEPOLIA_RPC_URL not set");
              return;
          }

          address owner = address(0xCAFE);
          string memory handle = "forktest-agent";

          uint256 salt = uint256(keccak256(abi.encode(owner, handle)));
          address expected =
              ILightAccountFactory(LIGHT_ACCOUNT_FACTORY).getAddress(owner, salt);

          vm.prank(owner);
          (uint256 agentId, address wallet) = registry.spawnAgent(
              handle,
              0x1111111111111111111111111111111111111111111111111111111111111111,
              0x2222222222222222222222222222222222222222222222222222222222222222
          );

          assertEq(agentId, 1, "first agent id");
          assertTrue(wallet != address(0), "real factory must return a non-zero wallet");
          assertEq(wallet, expected, "registry wallet must match real factory.getAddress");
      }
  }
  ```

- [ ] **Step 2: Run the fork test against Base Sepolia** (requires `BASE_SEPOLIA_RPC_URL` in `packages/contracts/.env`). Run from repo root:
  ```bash
  forge test --root packages/contracts \
    --match-path test/AgentRegistryFork.t.sol \
    --fork-url base_sepolia -vvv
  ```
  Expected PASS:
  ```
  Ran 1 test for test/AgentRegistryFork.t.sol:AgentRegistryForkTest
  [PASS] test_RealFactory_ReturnsCounterfactualWallet() (gas: ...)
  Suite result: ok. 1 passed; 0 failed; 0 skipped
  ```
  Without a fork URL the same test PASSES by logging `skipping fork test: BASE_SEPOLIA_RPC_URL not set` — confirming the local `forge test` (Task 10 Step 2) stays green offline.

- [ ] **Step 3: Confirm the whole suite (unit + fork-skip) still passes offline.** Run from repo root with no RPC env:
  ```bash
  forge test --root packages/contracts -vvv
  ```
  Expected: `12 passed; 0 failed` (11 unit + 1 fork test taking the skip branch).

- [ ] **Step 4: Commit the fork test.** Run from repo root:
  ```bash
  git add packages/contracts/test/AgentRegistryFork.t.sol
  git commit -m "test(contracts): add opt-in Base Sepolia fork test for getAddress

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds.

---

### Task 13: Deploy to Base Sepolia and propagate the address + deploy block into web and indexer env

Broadcast the real deployment, capture the registry address and deploy block from the script output, then write them into the `apps/web` and `apps/indexer` env files using the SHARED env var names (`NEXT_PUBLIC_REGISTRY_ADDRESS`, `REGISTRY_ADDRESS`, `DEPLOY_BLOCK`).

**Files:**
- Create: `apps/web/.env.local.example`
- Create: `apps/indexer/.env.example`
- (Operator-only, not committed) `apps/web/.env.local`, `apps/indexer/.env`

- [ ] **Step 1: Broadcast + verify the deployment to Base Sepolia.** Requires `BASE_SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `ETHERSCAN_API_KEY` in `packages/contracts/.env`. Run from repo root:
  ```bash
  forge script script/Deploy.s.sol:Deploy \
    --root packages/contracts \
    --rpc-url base_sepolia \
    --broadcast \
    --verify -vvv
  ```
  Expected: an on-chain tx, then `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.`, the three `console2.log` lines, and verification ending with `Contract successfully verified`. Note the printed `AgentRegistry deployed at: 0x...` and `Deploy block (DEPLOY_BLOCK): <number>`.

- [ ] **Step 2: Recover the address + block from the broadcast artifact** (authoritative source if the console scrolled). Run from repo root:
  ```bash
  cat packages/contracts/broadcast/Deploy.s.sol/84532/run-latest.json | grep -E '"contractAddress"|"blockNumber"' | head
  ```
  Expected: prints the `contractAddress` (the registry) and the `blockNumber` of the deploy tx. (`blockNumber` is hex in the artifact; convert with `cast --to-dec <hex>` for `DEPLOY_BLOCK`.) `broadcast/` is gitignored (Task 8), so the artifact stays local.

- [ ] **Step 3: Write `apps/web/.env.local.example`** with the SHARED env names, leaving placeholders the operator replaces with the Step 2 values. FULL contents:
  ```
  # Filled from packages/contracts deploy output (Task 13)
  NEXT_PUBLIC_REGISTRY_ADDRESS=0xYourDeployedAgentRegistryAddress
  NEXT_PUBLIC_WALLETCONNECT_ID=your_walletconnect_project_id

  # Read API + manifest pinning
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/aeonomy
  PINATA_JWT=your_pinata_jwt
  IPFS_GATEWAY=gateway.pinata.cloud
  ```

- [ ] **Step 4: Write `apps/indexer/.env.example`** with the SHARED env names including `DEPLOY_BLOCK`. FULL contents:
  ```
  # Filled from packages/contracts deploy output (Task 13)
  REGISTRY_ADDRESS=0xYourDeployedAgentRegistryAddress
  DEPLOY_BLOCK=0

  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/aeonomy
  IPFS_GATEWAY=gateway.pinata.cloud
  ```

- [ ] **Step 5: Copy the examples into real (gitignored) env files and fill in the deployed values.** Run from repo root, substituting the actual address and decimal block from Step 2:
  ```bash
  mkdir -p apps/web apps/indexer
  cp apps/web/.env.local.example apps/web/.env.local
  cp apps/indexer/.env.example apps/indexer/.env
  # Then edit apps/web/.env.local: set NEXT_PUBLIC_REGISTRY_ADDRESS=<deployed address>
  # Then edit apps/indexer/.env: set REGISTRY_ADDRESS=<deployed address> and DEPLOY_BLOCK=<decimal block>
  ```
  Expected: both real env files exist. (`.env.local` and `.env` must be covered by the repo-root `.gitignore` created in the workspace-setup phase; verify with `git status` that they are NOT staged.)

- [ ] **Step 6: Verify the env files are consistent** (same registry address in both). Run from repo root:
  ```bash
  grep REGISTRY_ADDRESS apps/web/.env.local apps/indexer/.env
  ```
  Expected: the address after `NEXT_PUBLIC_REGISTRY_ADDRESS=` (web) matches the address after `REGISTRY_ADDRESS=` (indexer), and is the Step 2 `contractAddress`.

- [ ] **Step 7: Commit the env examples** (only the `.example` files; real env files stay untracked). Run from repo root:
  ```bash
  git add apps/web/.env.local.example apps/indexer/.env.example
  git commit -m "chore(env): add web/indexer env examples with deployed registry placeholders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```
  Expected: commit succeeds; `git status` shows `apps/web/.env.local` and `apps/indexer/.env` as untracked/ignored.

## Phase 2: Backend — skill seed, indexer, read API & manifest pin

This phase builds every non-UI backend unit that consumes the Phase 1 `@aeonomy/shared` package and the Phase 1 Postgres schema (`migrations/001_init.sql`): the Aeon skill seed script, the standalone indexer (`apps/indexer`), and the five Next.js read/write route handlers in `apps/web/app/api`. All response shapes, table columns, helper signatures, and addresses are consumed VERBATIM from the SHARED INTERFACE.

**Assumptions carried in from earlier phases (do not re-create here):**
- `@aeonomy/shared` exports: `cidToBytes32(cid: string): \`0x${string}\``, `bytes32ToCidV0(h: \`0x${string}\`): string`, `computeConfigHash(config: object): \`0x${string}\``, `computeSalt`, `predictWallet`, plus types `Manifest`, `Persona`, and the `AgentRegistry` ABI export named `agentRegistryAbi` and the `AgentSpawned` event fragment.
- `migrations/001_init.sql` already defines `skills`, `agents`, `indexer_state` exactly as in SHARED.
- Root `pnpm-workspace.yaml` lists `packages/*` and `apps/*`. `docker-compose.yml` runs local Postgres 16; `DATABASE_URL` points at it.
- Vitest 2 is the test runner for `apps/indexer`, the seed script (run from repo root), and `apps/web` unit tests.

A pre-existing Postgres is required for the integration-flavored tests; where a live DB is awkward we use a tiny in-memory fake `pg` Pool so tests stay hermetic and fast.

---

### Task 14: Seed-skills package scaffold + fixture + failing mapping test

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/tsconfig.json`
- Create: `scripts/vitest.config.ts`
- Create: `scripts/test/fixtures/skills.sample.json`
- Create: `scripts/src/mapSkills.ts`
- Test: `scripts/test/mapSkills.test.ts`

- [ ] **Step 1: Create `scripts/package.json`** (full contents):
```json
{
  "name": "@aeonomy/scripts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "seed:skills": "tsx src/seed-skills.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aeonomy/shared": "workspace:*",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/pg": "^8.11.5",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `scripts/tsconfig.json`** (full contents):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `scripts/vitest.config.ts`** (full contents):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create the fixture `scripts/test/fixtures/skills.sample.json`** — a small, faithful subset of the real Aeon `skills.json` shape (object with `total` and a `skills` array; entries have `slug`,`name`,`description`,`category` and Aeon extras, NO `tags`). Note `total` here is `3` and the array has `3` entries — the mapper must read length from the array, not trust `total`, but we keep them equal to model the real file:
```json
{
  "version": "1.0",
  "generated": "2026-06-10T13:06:51Z",
  "repo": "aaronjmars/aeon",
  "total": 3,
  "categories": ["productivity", "social"],
  "skills": [
    {
      "slug": "action-converter",
      "name": "Action Converter",
      "description": "5 concrete real-life actions, leverage-scored against open loops with specificity and anti-fluff gates",
      "category": "productivity",
      "schedule": "0 18 * * *",
      "var": "",
      "requires": [],
      "mcp": [],
      "files": 0,
      "sha": "516a854",
      "updated": "2026-06-09",
      "install": "./add-skill aaronjmars/aeon action-converter"
    },
    {
      "slug": "agent-buzz",
      "name": "Agent Buzz",
      "description": "Curated AI-agent tweets, clustered into narratives with insight summaries",
      "category": "social",
      "schedule": "30 17 * * *",
      "var": "",
      "requires": [{ "key": "XAI_API_KEY", "optional": false }],
      "mcp": [],
      "files": 0,
      "sha": "004c1b5",
      "updated": "2026-06-09",
      "install": "./add-skill aaronjmars/aeon agent-buzz"
    },
    {
      "slug": "no-category-skill",
      "name": "No Category Skill",
      "description": "An entry deliberately missing a category to test the null path",
      "schedule": "0 9 * * *",
      "var": "",
      "requires": [],
      "mcp": [],
      "files": 0,
      "sha": "deadbee",
      "updated": "2026-06-09",
      "install": "./add-skill aaronjmars/aeon no-category-skill"
    }
  ]
}
```

- [ ] **Step 5: Write the FAILING test `scripts/test/mapSkills.test.ts`** (full contents). It pins the pure mapping from raw catalog -> rows we will upsert:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mapSkills, type SkillRow, type AeonCatalog } from '../src/mapSkills';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'skills.sample.json'), 'utf8'),
) as AeonCatalog;

describe('mapSkills', () => {
  it('maps every entry in the skills array (count from array, not the total field)', () => {
    const rows = mapSkills(catalog);
    expect(rows).toHaveLength(catalog.skills.length);
    expect(rows).toHaveLength(3);
  });

  it('maps slug/name/description verbatim and category as-is', () => {
    const rows = mapSkills(catalog);
    const row = rows.find((r) => r.slug === 'action-converter') as SkillRow;
    expect(row).toEqual({
      slug: 'action-converter',
      name: 'Action Converter',
      description:
        '5 concrete real-life actions, leverage-scored against open loops with specificity and anti-fluff gates',
      category: 'productivity',
      tags: [],
      source: 'aeon',
    });
  });

  it('defaults missing category to null and tags to empty array', () => {
    const rows = mapSkills(catalog);
    const row = rows.find((r) => r.slug === 'no-category-skill') as SkillRow;
    expect(row.category).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.source).toBe('aeon');
  });

  it('skips entries with no slug', () => {
    const dirty: AeonCatalog = {
      ...catalog,
      skills: [...catalog.skills, { name: 'Bad', description: 'no slug' } as any],
    };
    const rows = mapSkills(dirty);
    expect(rows).toHaveLength(3);
  });
});
```

- [ ] **Step 6: Run the test and watch it FAIL** (module does not exist yet):
```
pnpm --filter @aeonomy/scripts test
```
Expected FAIL output contains: `Failed to load url ../src/mapSkills` / `Cannot find module '../src/mapSkills'`.

- [ ] **Step 7: Create the minimal implementation `scripts/src/mapSkills.ts`** (full contents):
```ts
export interface AeonSkillEntry {
  slug?: string;
  name?: string;
  description?: string;
  category?: string | null;
  [k: string]: unknown;
}

export interface AeonCatalog {
  version?: string;
  generated?: string;
  repo?: string;
  total?: number;
  categories?: string[];
  skills: AeonSkillEntry[];
  [k: string]: unknown;
}

export interface SkillRow {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  source: string;
}

/**
 * Pure mapping from the Aeon catalog object to the rows we upsert into `skills`.
 * The catalog drifts (197 today, may change) — we count from the array, never the
 * `total` field. Aeon entries carry no `tags`, so tags default to []. source = 'aeon'.
 */
export function mapSkills(catalog: AeonCatalog): SkillRow[] {
  const entries = Array.isArray(catalog.skills) ? catalog.skills : [];
  const rows: SkillRow[] = [];
  for (const e of entries) {
    if (!e || typeof e.slug !== 'string' || e.slug.length === 0) continue;
    rows.push({
      slug: e.slug,
      name: typeof e.name === 'string' ? e.name : e.slug,
      description: typeof e.description === 'string' ? e.description : '',
      category:
        typeof e.category === 'string' && e.category.length > 0 ? e.category : null,
      tags: [],
      source: 'aeon',
    });
  }
  return rows;
}
```

- [ ] **Step 8: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/scripts test
```
Expected PASS output contains: `Test Files  1 passed (1)` and `Tests  4 passed (4)`.

- [ ] **Step 9: Commit:**
```
git add scripts/package.json scripts/tsconfig.json scripts/vitest.config.ts scripts/test/fixtures/skills.sample.json scripts/src/mapSkills.ts scripts/test/mapSkills.test.ts
git commit -m "feat(scripts): pure Aeon skills.json -> skills row mapper with fixture test"
```

---

### Task 15: Seed-skills upsert runner (idempotent, count from skills.json)

**Files:**
- Create: `scripts/src/upsertSkills.ts`
- Create: `scripts/src/seed-skills.ts`
- Test: `scripts/test/upsertSkills.test.ts`

- [ ] **Step 1: Write the FAILING test `scripts/test/upsertSkills.test.ts`** (full contents). It uses a tiny in-memory fake `pg` Pool that records every parameterized query, so we assert the exact upsert SQL + params and idempotency without a live DB:
```ts
import { describe, it, expect, vi } from 'vitest';
import { upsertSkills } from '../src/upsertSkills';
import type { SkillRow } from '../src/mapSkills';

interface Call {
  text: string;
  values: unknown[];
}

function fakePool() {
  const calls: Call[] = [];
  const pool = {
    calls,
    async query(text: string, values: unknown[]) {
      calls.push({ text, values });
      return { rowCount: 1, rows: [] };
    },
  };
  return pool;
}

const rows: SkillRow[] = [
  {
    slug: 'action-converter',
    name: 'Action Converter',
    description: 'desc one',
    category: 'productivity',
    tags: [],
    source: 'aeon',
  },
  {
    slug: 'no-category-skill',
    name: 'No Category Skill',
    description: 'desc two',
    category: null,
    tags: [],
    source: 'aeon',
  },
];

describe('upsertSkills', () => {
  it('issues one parameterized upsert per row with ON CONFLICT DO UPDATE', async () => {
    const pool = fakePool();
    const n = await upsertSkills(pool as any, rows);
    expect(n).toBe(2);
    expect(pool.calls).toHaveLength(2);

    const first = pool.calls[0];
    expect(first.text).toContain('INSERT INTO skills');
    expect(first.text).toContain('ON CONFLICT (slug) DO UPDATE');
    expect(first.text).toContain('$1');
    expect(first.text).toContain('$6');
    // params order: slug, name, description, category, tags(jsonb text), source
    expect(first.values[0]).toBe('action-converter');
    expect(first.values[1]).toBe('Action Converter');
    expect(first.values[2]).toBe('desc one');
    expect(first.values[3]).toBe('productivity');
    expect(first.values[4]).toBe('[]');
    expect(first.values[5]).toBe('aeon');
  });

  it('passes null category through as a bound param', async () => {
    const pool = fakePool();
    await upsertSkills(pool as any, rows);
    expect(pool.calls[1].values[3]).toBeNull();
  });

  it('is idempotent: running twice issues the same statements and never throws', async () => {
    const pool = fakePool();
    await upsertSkills(pool as any, rows);
    await upsertSkills(pool as any, rows);
    expect(pool.calls).toHaveLength(4);
    expect(pool.calls[0].text).toBe(pool.calls[2].text);
  });
});
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/scripts test upsertSkills
```
Expected FAIL output contains: `Cannot find module '../src/upsertSkills'`.

- [ ] **Step 3: Create `scripts/src/upsertSkills.ts`** (full contents). Uses raw parameterized SQL (no ORM, per SHARED). `tags` is bound as a JSON string and cast to `jsonb` in SQL:
```ts
import type { SkillRow } from './mapSkills';

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<{ rowCount: number | null; rows: unknown[] }>;
}

const UPSERT_SQL = `INSERT INTO skills (slug, name, description, category, tags, source)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  source = EXCLUDED.source`;

/**
 * Idempotently upserts skill rows. Safe to run repeatedly: ON CONFLICT (slug)
 * refreshes mutable columns. Returns the number of rows processed.
 */
export async function upsertSkills(pool: QueryablePool, rows: SkillRow[]): Promise<number> {
  let n = 0;
  for (const r of rows) {
    await pool.query(UPSERT_SQL, [
      r.slug,
      r.name,
      r.description,
      r.category,
      JSON.stringify(r.tags),
      r.source,
    ]);
    n += 1;
  }
  return n;
}
```

- [ ] **Step 4: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/scripts test upsertSkills
```
Expected PASS output contains: `Tests  3 passed (3)`.

- [ ] **Step 5: Create the runnable seed entrypoint `scripts/src/seed-skills.ts`** (full contents). It fetches the live catalog, logs the total it READ (never hardcodes 197), maps, and upserts inside a transaction:
```ts
import { Pool } from 'pg';
import { mapSkills, type AeonCatalog } from './mapSkills';
import { upsertSkills } from './upsertSkills';

const CATALOG_URL =
  process.env.AEON_SKILLS_URL ??
  'https://raw.githubusercontent.com/aaronjmars/aeon/main/skills.json';

async function fetchCatalog(url: string): Promise<AeonCatalog> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Aeon skills.json: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AeonCatalog;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const catalog = await fetchCatalog(CATALOG_URL);
  const rows = mapSkills(catalog);
  // Read the count from the data, never hardcode (catalog drifts; ~197 today).
  console.log(
    `Aeon catalog: total field = ${catalog.total ?? 'n/a'}, mapped rows = ${rows.length}`,
  );

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query('BEGIN');
    const n = await upsertSkills(pool, rows);
    await pool.query('COMMIT');
    console.log(`Seeded ${n} skills.`);
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6: Type-check the package compiles cleanly:**
```
pnpm --filter @aeonomy/scripts exec tsc --noEmit
```
Expected: no output, exit code 0.

- [ ] **Step 7: (Optional live smoke — only if Postgres is up via docker-compose and migrations applied.) Run the seed twice to prove idempotency end-to-end:**
```
DATABASE_URL=$env:DATABASE_URL pnpm --filter @aeonomy/scripts seed:skills
pnpm --filter @aeonomy/scripts seed:skills
```
Expected: first run prints `mapped rows = 197` (or current count) then `Seeded 197 skills.`; second run prints the same `Seeded N skills.` with no error (row count in DB unchanged). Skip this step in CI where DB is absent.

- [ ] **Step 8: Commit:**
```
git add scripts/src/upsertSkills.ts scripts/src/seed-skills.ts scripts/test/upsertSkills.test.ts
git commit -m "feat(scripts): idempotent skills upsert + seed-skills runner (count read from catalog)"
```

---

### Task 16: Indexer scaffold + db helpers (pg Pool) with failing test

**Files:**
- Create: `apps/indexer/package.json`
- Create: `apps/indexer/tsconfig.json`
- Create: `apps/indexer/vitest.config.ts`
- Create: `apps/indexer/src/db.ts`
- Test: `apps/indexer/test/db.test.ts`

- [ ] **Step 1: Create `apps/indexer/package.json`** (full contents):
```json
{
  "name": "@aeonomy/indexer",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aeonomy/shared": "workspace:*",
    "pg": "^8.11.5",
    "viem": "^2.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/pg": "^8.11.5",
    "tsx": "^4.7.2",
    "typescript": "^5.4.5",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/indexer/tsconfig.json`** (full contents):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `apps/indexer/vitest.config.ts`** (full contents):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write the FAILING test `apps/indexer/test/db.test.ts`** (full contents). It exercises the db helpers against the in-memory fake Pool, pinning the exact SQL for reading/writing `indexer_state` and upserting `agents` with `ON CONFLICT (agent_id) DO NOTHING`:
```ts
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
```

- [ ] **Step 5: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/indexer test db
```
Expected FAIL output contains: `Cannot find module '../src/db'`.

- [ ] **Step 6: Create `apps/indexer/src/db.ts`** (full contents). Column order matches `migrations/001_init.sql` exactly; bigints bound as strings (pg-safe), jsonb bound as JSON text and cast in SQL:
```ts
import type { Persona } from '@aeonomy/shared';

export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}

export interface AgentInsert {
  agentId: bigint;
  owner: string;
  wallet: string;
  handle: string;
  manifestHash: string;
  manifestCid: string | null;
  configHash: string;
  persona: Persona | null;
  skills: string[];
  createdAt: bigint;
  blockNumber: bigint;
  txHash: string;
}

export async function getLastBlock(pool: QueryablePool): Promise<bigint | null> {
  const res = await pool.query('SELECT last_block FROM indexer_state WHERE id = 1');
  if (res.rows.length === 0) return null;
  const v = res.rows[0].last_block as string | number | bigint;
  return BigInt(v as string);
}

export async function setLastBlock(pool: QueryablePool, block: bigint): Promise<void> {
  await pool.query(
    `INSERT INTO indexer_state (id, last_block)
     VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET last_block = EXCLUDED.last_block`,
    [block.toString()],
  );
}

const UPSERT_AGENT_SQL = `INSERT INTO agents (
  agent_id, owner, wallet, handle, manifest_hash, manifest_cid,
  config_hash, persona, skills, created_at, block_number, tx_hash
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8::jsonb, $9::jsonb, $10, $11, $12
)
ON CONFLICT (agent_id) DO NOTHING`;

export async function upsertAgent(pool: QueryablePool, a: AgentInsert): Promise<boolean> {
  const res = await pool.query(UPSERT_AGENT_SQL, [
    a.agentId.toString(),
    a.owner,
    a.wallet,
    a.handle,
    a.manifestHash,
    a.manifestCid,
    a.configHash,
    a.persona === null ? null : JSON.stringify(a.persona),
    JSON.stringify(a.skills),
    a.createdAt.toString(),
    a.blockNumber.toString(),
    a.txHash,
  ]);
  return (res.rowCount ?? 0) > 0;
}
```

- [ ] **Step 7: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/indexer test db
```
Expected PASS output contains: `Tests  3 passed (3)`.

- [ ] **Step 8: Commit:**
```
git add apps/indexer/package.json apps/indexer/tsconfig.json apps/indexer/vitest.config.ts apps/indexer/src/db.ts apps/indexer/test/db.test.ts
git commit -m "feat(indexer): pg db helpers for indexer_state + agents upsert (DO NOTHING)"
```

---

### Task 17: Indexer log -> AgentInsert mapping + manifest enrichment (failing test first)

**Files:**
- Create: `apps/indexer/src/mapLog.ts`
- Test: `apps/indexer/test/mapLog.test.ts`

- [ ] **Step 1: Write the FAILING test `apps/indexer/test/mapLog.test.ts`** (full contents). It pins (a) decoded-log -> `AgentInsert` field mapping, and (b) manifest enrichment that fetches `IPFS_GATEWAY/ipfs/<cid>` via `bytes32ToCidV0(manifestHash)` to fill `persona`/`skills`/`manifestCid`, with a graceful fallback when the gateway fails:
```ts
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
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/indexer test mapLog
```
Expected FAIL output contains: `Cannot find module '../src/mapLog'`.

- [ ] **Step 3: Create `apps/indexer/src/mapLog.ts`** (full contents):
```ts
import { bytes32ToCidV0, type Persona, type Manifest } from '@aeonomy/shared';
import type { AgentInsert } from './db';

export interface DecodedSpawnLog {
  args: {
    agentId: bigint;
    owner: `0x${string}`;
    wallet: `0x${string}`;
    handle: string;
    manifestHash: `0x${string}`;
    configHash: `0x${string}`;
  };
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

export interface EnrichOptions {
  gateway: string;
  fetchImpl?: typeof fetch;
}

/** Map a decoded AgentSpawned log into an AgentInsert with manifest fields still empty. */
export function logToAgentBase(log: DecodedSpawnLog, createdAt: bigint): AgentInsert {
  return {
    agentId: log.args.agentId,
    owner: log.args.owner,
    wallet: log.args.wallet,
    handle: log.args.handle,
    manifestHash: log.args.manifestHash,
    manifestCid: null,
    configHash: log.args.configHash,
    persona: null,
    skills: [],
    createdAt,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
  };
}

/**
 * Resolve the CIDv0 from manifestHash, fetch the manifest JSON from the IPFS
 * gateway, and fill persona/skills/manifestCid. On any fetch/parse failure we
 * still record the manifestCid (it is derived, not fetched) and leave persona
 * null / skills [] so the indexer remains resilient and idempotent.
 */
export async function enrichWithManifest(
  base: AgentInsert,
  opts: EnrichOptions,
): Promise<AgentInsert> {
  const cid = bytes32ToCidV0(base.manifestHash as `0x${string}`);
  const gw = opts.gateway.replace(/\/+$/, '');
  const url = `${gw}/ipfs/${cid}`;
  const f = opts.fetchImpl ?? fetch;

  const enriched: AgentInsert = { ...base, manifestCid: cid };
  try {
    const res = await f(url);
    if (!res.ok) return enriched;
    const manifest = (await res.json()) as Partial<Manifest>;
    const persona = manifest.persona;
    if (
      persona &&
      typeof persona.displayName === 'string' &&
      typeof persona.bio === 'string' &&
      typeof persona.avatarSeed === 'string'
    ) {
      enriched.persona = persona as Persona;
    }
    if (Array.isArray(manifest.skills)) {
      enriched.skills = manifest.skills.filter((s): s is string => typeof s === 'string');
    }
  } catch {
    // swallow — derived cid already recorded; persona/skills stay empty
  }
  return enriched;
}
```

- [ ] **Step 4: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/indexer test mapLog
```
Expected PASS output contains: `Tests  4 passed (4)`.

- [ ] **Step 5: Commit:**
```
git add apps/indexer/src/mapLog.ts apps/indexer/test/mapLog.test.ts
git commit -m "feat(indexer): decode log -> AgentInsert + resilient IPFS manifest enrichment"
```

---

### Task 18: Indexer core poll loop (chunked getLogs, resume, idempotent) + test

**Files:**
- Create: `apps/indexer/src/indexer.ts`
- Test: `apps/indexer/test/indexer.test.ts`

- [ ] **Step 1: Write the FAILING test `apps/indexer/test/indexer.test.ts`** (full contents). It mocks the viem client and the db helpers, asserting: chunking at <=2000 blocks, start from `last_block+1` (default `DEPLOY_BLOCK` when state empty), upsert each decoded log, persist `last_block`, and a re-run from the persisted block (idempotency / resume):
```ts
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
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/indexer test indexer
```
Expected FAIL output contains: `Cannot find module '../src/indexer'`.

- [ ] **Step 3: Create `apps/indexer/src/indexer.ts`** (full contents). Pure orchestration over injected deps so it is fully testable; `runLoop` wires the loop + delay:
```ts
import type { AgentInsert } from './db';
import type { DecodedSpawnLog, EnrichOptions } from './mapLog';
import { logToAgentBase, enrichWithManifest } from './mapLog';

export interface IndexerDeps {
  chunkSize: bigint;
  deployBlock: bigint;
  gateway: string;
  getCurrentBlock: () => Promise<bigint>;
  getLastBlock: () => Promise<bigint | null>;
  setLastBlock: (block: bigint) => Promise<void>;
  getLogsChunk: (fromBlock: bigint, toBlock: bigint) => Promise<DecodedSpawnLog[]>;
  getBlockTimestamp: (block: bigint) => Promise<bigint>;
  upsertAgent: (agent: AgentInsert) => Promise<boolean>;
  enrich: (base: AgentInsert, opts: EnrichOptions) => Promise<AgentInsert>;
}

/**
 * Process every AgentSpawned log from (last_block+1) to the current head in
 * <=chunkSize windows. Idempotent (db upsert is ON CONFLICT DO NOTHING) and
 * resumable (last_block persisted after each successful chunk). Returns count
 * of logs processed.
 */
export async function runOnce(deps: IndexerDeps): Promise<number> {
  const last = (await deps.getLastBlock()) ?? deps.deployBlock;
  const head = await deps.getCurrentBlock();
  if (head <= last) return 0;

  let processed = 0;
  let from = last + 1n;
  while (from <= head) {
    let to = from + deps.chunkSize - 1n;
    if (to > head) to = head;

    const logs = await deps.getLogsChunk(from, to);
    for (const log of logs) {
      const ts = await deps.getBlockTimestamp(log.blockNumber);
      const base = logToAgentBase(log, ts);
      const enriched = await deps.enrich(base, { gateway: deps.gateway });
      await deps.upsertAgent(enriched);
      processed += 1;
    }

    await deps.setLastBlock(to);
    from = to + 1n;
  }
  return processed;
}

export interface LoopOptions {
  delayMs: number;
  signal?: { aborted: boolean };
}

export async function runLoop(deps: IndexerDeps, opts: LoopOptions): Promise<void> {
  // Default enrich impl if caller passed a thin one.
  for (;;) {
    if (opts.signal?.aborted) return;
    try {
      const n = await runOnce(deps);
      if (n > 0) console.log(`indexed ${n} agents`);
    } catch (err) {
      console.error('indexer poll failed, will retry:', err);
    }
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }
}

// Re-export the real enrich so main.ts can inject it.
export { enrichWithManifest };
```

- [ ] **Step 4: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/indexer test indexer
```
Expected PASS output contains: `Tests  4 passed (4)`.

- [ ] **Step 5: Commit:**
```
git add apps/indexer/src/indexer.ts apps/indexer/test/indexer.test.ts
git commit -m "feat(indexer): chunked getLogs poll loop with resume + idempotency (runOnce)"
```

---

### Task 19: Indexer entrypoint wiring (viem publicClient, env, real deps)

**Files:**
- Create: `apps/indexer/src/client.ts`
- Create: `apps/indexer/src/main.ts`
- Create: `apps/indexer/.env.example`

- [ ] **Step 1: Create `apps/indexer/src/client.ts`** (full contents) — the viem publicClient on Base Sepolia and a typed `getLogs` for `AgentSpawned`:
```ts
import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { DecodedSpawnLog } from './mapLog';

export const AGENT_SPAWNED_EVENT = parseAbiItem(
  'event AgentSpawned(uint256 indexed agentId, address indexed owner, address wallet, string handle, bytes32 manifestHash, bytes32 configHash)',
);

export function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

export async function getCurrentBlock(client: PublicClient): Promise<bigint> {
  return client.getBlockNumber();
}

export async function getBlockTimestamp(client: PublicClient, block: bigint): Promise<bigint> {
  const b = await client.getBlock({ blockNumber: block });
  return b.timestamp;
}

export async function getLogsChunk(
  client: PublicClient,
  address: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<DecodedSpawnLog[]> {
  const logs = await client.getLogs({
    address,
    event: AGENT_SPAWNED_EVENT,
    fromBlock,
    toBlock,
  });
  return logs.map((l) => ({
    args: {
      agentId: l.args.agentId as bigint,
      owner: l.args.owner as `0x${string}`,
      wallet: l.args.wallet as `0x${string}`,
      handle: l.args.handle as string,
      manifestHash: l.args.manifestHash as `0x${string}`,
      configHash: l.args.configHash as `0x${string}`,
    },
    blockNumber: l.blockNumber as bigint,
    transactionHash: l.transactionHash as `0x${string}`,
  }));
}
```

- [ ] **Step 2: Create `apps/indexer/src/main.ts`** (full contents) — reads env, builds real deps, runs the loop:
```ts
import { Pool } from 'pg';
import { getLastBlock, setLastBlock, upsertAgent } from './db';
import { runLoop, enrichWithManifest, type IndexerDeps } from './indexer';
import {
  makeClient,
  getCurrentBlock,
  getBlockTimestamp,
  getLogsChunk,
} from './client';

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function main(): Promise<void> {
  const rpcUrl = reqEnv('BASE_SEPOLIA_RPC_URL');
  const databaseUrl = reqEnv('DATABASE_URL');
  const registry = reqEnv('REGISTRY_ADDRESS') as `0x${string}`;
  const gateway = process.env.IPFS_GATEWAY ?? 'https://gateway.pinata.cloud';
  const deployBlock = BigInt(process.env.DEPLOY_BLOCK ?? '0');
  const delayMs = Number(process.env.INDEXER_POLL_MS ?? '5000');

  const client = makeClient(rpcUrl);
  const pool = new Pool({ connectionString: databaseUrl });

  const deps: IndexerDeps = {
    chunkSize: 2000n,
    deployBlock,
    gateway,
    getCurrentBlock: () => getCurrentBlock(client),
    getLastBlock: () => getLastBlock(pool),
    setLastBlock: (b) => setLastBlock(pool, b),
    getLogsChunk: (from, to) => getLogsChunk(client, registry, from, to),
    getBlockTimestamp: (b) => getBlockTimestamp(client, b),
    upsertAgent: (a) => upsertAgent(pool, a),
    enrich: (base, opts) => enrichWithManifest(base, opts),
  };

  console.log(
    `indexer starting: registry=${registry} deployBlock=${deployBlock} gateway=${gateway}`,
  );
  await runLoop(deps, { delayMs });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Create `apps/indexer/.env.example`** (full contents):
```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
DATABASE_URL=postgres://aeon:aeon@localhost:5432/aeon
REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
IPFS_GATEWAY=https://gateway.pinata.cloud
DEPLOY_BLOCK=0
INDEXER_POLL_MS=5000
```

- [ ] **Step 4: Type-check the indexer compiles cleanly:**
```
pnpm --filter @aeonomy/indexer exec tsc --noEmit
```
Expected: no output, exit code 0.

- [ ] **Step 5: Run the full indexer test suite to confirm nothing regressed:**
```
pnpm --filter @aeonomy/indexer test
```
Expected PASS output contains: `Test Files  3 passed (3)`.

- [ ] **Step 6: Commit:**
```
git add apps/indexer/src/client.ts apps/indexer/src/main.ts apps/indexer/.env.example
git commit -m "feat(indexer): viem baseSepolia client + env-wired main entrypoint"
```

---

### Task 20: Web API — handle format validator + `GET /api/agents/handle-available` (test first)

**Files:**
- Create: `apps/web/lib/handle.ts`
- Create: `apps/web/lib/db.ts`
- Create: `apps/web/app/api/agents/handle-available/route.ts`
- Test: `apps/web/test/handle.test.ts`
- Test: `apps/web/test/handle-available.route.test.ts`

> Assumes `apps/web` already exists from the frontend scaffold phase with Next.js 15 + Vitest configured (`apps/web/vitest.config.ts`, `test` script). If the web Vitest config does not yet exist, create `apps/web/vitest.config.ts` with `test: { environment: 'node', include: ['test/**/*.test.ts'] }` as part of Step 0 here.

- [ ] **Step 0 (only if missing): Create `apps/web/vitest.config.ts`** (full contents):
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
```

- [ ] **Step 1: Write the FAILING test `apps/web/test/handle.test.ts`** (full contents). It pins the SAME charset/length rules as the contract `_validateHandle`: bytes length 3..32, each byte `[a-z]`, `[0-9]`, or `-` (0x2d), lowercase only:
```ts
import { describe, it, expect } from 'vitest';
import { validateHandleFormat } from '../lib/handle';

describe('validateHandleFormat', () => {
  it('accepts a valid lowercase/dash/digit handle', () => {
    expect(validateHandleFormat('satoshi')).toEqual({ ok: true });
    expect(validateHandleFormat('a-1')).toEqual({ ok: true });
    expect(validateHandleFormat('agent-007-x')).toEqual({ ok: true });
  });

  it('rejects too short (<3)', () => {
    expect(validateHandleFormat('ab')).toEqual({ ok: false, reason: 'invalid_length' });
  });

  it('rejects too long (>32)', () => {
    expect(validateHandleFormat('a'.repeat(33))).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });

  it('rejects uppercase', () => {
    expect(validateHandleFormat('Satoshi')).toEqual({ ok: false, reason: 'invalid_charset' });
  });

  it('rejects disallowed characters (underscore, space, dot)', () => {
    expect(validateHandleFormat('a_b')).toEqual({ ok: false, reason: 'invalid_charset' });
    expect(validateHandleFormat('a b')).toEqual({ ok: false, reason: 'invalid_charset' });
    expect(validateHandleFormat('a.b')).toEqual({ ok: false, reason: 'invalid_charset' });
  });

  it('counts bytes not code points (multibyte char fails charset)', () => {
    expect(validateHandleFormat('café')).toEqual({ ok: false, reason: 'invalid_charset' });
  });
});
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test handle.test
```
Expected FAIL output contains: `Cannot find module '../lib/handle'`.

- [ ] **Step 3: Create `apps/web/lib/handle.ts`** (full contents). Byte-accurate validation mirroring the Solidity `_validateHandle`:
```ts
export type HandleCheck = { ok: true } | { ok: false; reason: 'invalid_length' | 'invalid_charset' };

/**
 * Mirrors the contract's _validateHandle (pure): byte length 3..32; each byte
 * must be [a-z] (0x61..0x7a), [0-9] (0x30..0x39), or '-' (0x2d). Lowercase only.
 */
export function validateHandleFormat(handle: string): HandleCheck {
  const bytes = new TextEncoder().encode(handle);
  if (bytes.length < 3 || bytes.length > 32) {
    return { ok: false, reason: 'invalid_length' };
  }
  for (const b of bytes) {
    const isLower = b >= 0x61 && b <= 0x7a;
    const isDigit = b >= 0x30 && b <= 0x39;
    const isDash = b === 0x2d;
    if (!isLower && !isDigit && !isDash) {
      return { ok: false, reason: 'invalid_charset' };
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/web test handle.test
```
Expected PASS output contains: `Tests  6 passed (6)`.

- [ ] **Step 5: Create the shared web db pool `apps/web/lib/db.ts`** (full contents) — a single lazy `pg` Pool reused by every route, overridable in tests:
```ts
import { Pool } from 'pg';

export interface QueryResultLike {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

export interface QueryablePool {
  query(text: string, values?: unknown[]): Promise<QueryResultLike>;
}

let _pool: Pool | null = null;
let _override: QueryablePool | null = null;

/** Test seam: inject a fake pool. Pass null to clear. */
export function __setPoolForTests(p: QueryablePool | null): void {
  _override = p;
}

export function getPool(): QueryablePool {
  if (_override) return _override;
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    _pool = new Pool({ connectionString });
  }
  return _pool;
}
```

- [ ] **Step 6: Write the FAILING route test `apps/web/test/handle-available.route.test.ts`** (full contents). Response shape is `{ available: boolean, reason?: string }`, format-validated first then DB-checked:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/agents/handle-available/route';
import { __setPoolForTests } from '../lib/db';

function req(handle?: string) {
  const u = new URL('http://localhost/api/agents/handle-available');
  if (handle !== undefined) u.searchParams.set('handle', handle);
  return new Request(u);
}

beforeEach(() => __setPoolForTests(null));

describe('GET /api/agents/handle-available', () => {
  it('returns available:false with reason for a format-invalid handle (no DB hit)', async () => {
    let queried = false;
    __setPoolForTests({
      async query() {
        queried = true;
        return { rowCount: 0, rows: [] };
      },
    });
    const res = await GET(req('AB'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, reason: 'invalid_length' });
    expect(queried).toBe(false);
  });

  it('returns available:false reason invalid_charset for bad chars', async () => {
    __setPoolForTests({ async query() { return { rowCount: 0, rows: [] }; } });
    const res = await GET(req('a_b'));
    expect(await res.json()).toEqual({ available: false, reason: 'invalid_charset' });
  });

  it('returns available:true when format-valid and not in DB', async () => {
    __setPoolForTests({ async query() { return { rowCount: 0, rows: [] }; } });
    const res = await GET(req('satoshi'));
    expect(await res.json()).toEqual({ available: true });
  });

  it('returns available:false reason taken when handle exists in DB', async () => {
    __setPoolForTests({ async query() { return { rowCount: 1, rows: [{ handle: 'satoshi' }] }; } });
    const res = await GET(req('satoshi'));
    expect(await res.json()).toEqual({ available: false, reason: 'taken' });
  });

  it('returns 400 when handle param is missing', async () => {
    const res = await GET(req(undefined));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Run the route test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test handle-available.route
```
Expected FAIL output contains: `Cannot find module '../app/api/agents/handle-available/route'`.

- [ ] **Step 8: Create `apps/web/app/api/agents/handle-available/route.ts`** (full contents):
```ts
import { NextResponse } from 'next/server';
import { validateHandleFormat } from '../../../../lib/handle';
import { getPool } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const handle = url.searchParams.get('handle');
  if (handle === null) {
    return NextResponse.json({ error: 'handle query param is required' }, { status: 400 });
  }

  const fmt = validateHandleFormat(handle);
  if (!fmt.ok) {
    return NextResponse.json({ available: false, reason: fmt.reason });
  }

  const pool = getPool();
  const res = await pool.query('SELECT handle FROM agents WHERE handle = $1 LIMIT 1', [handle]);
  if ((res.rowCount ?? 0) > 0) {
    return NextResponse.json({ available: false, reason: 'taken' });
  }
  return NextResponse.json({ available: true });
}
```

- [ ] **Step 9: Re-run the route test and watch it PASS:**
```
pnpm --filter @aeonomy/web test handle-available.route
```
Expected PASS output contains: `Tests  5 passed (5)`.

- [ ] **Step 10: Commit:**
```
git add apps/web/lib/handle.ts apps/web/lib/db.ts apps/web/app/api/agents/handle-available/route.ts apps/web/test/handle.test.ts apps/web/test/handle-available.route.test.ts
git commit -m "feat(web): handle format validator + GET /api/agents/handle-available"
```

---

### Task 21: Web API — `GET /api/skills` (filters: category, q) test first

**Files:**
- Create: `apps/web/lib/rows.ts`
- Create: `apps/web/app/api/skills/route.ts`
- Test: `apps/web/test/skills.route.test.ts`

- [ ] **Step 1: Write the FAILING test `apps/web/test/skills.route.test.ts`** (full contents). Response shape `{ skills: Skill[] }` where `Skill = { slug,name,description,category,tags:string[] }`. Asserts the exact SQL filters for `category` and `q`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/skills/route';
import { __setPoolForTests } from '../lib/db';

interface Call { text: string; values: unknown[] }

function capturePool(rows: Record<string, unknown>[]) {
  const calls: Call[] = [];
  return {
    calls,
    pool: {
      async query(text: string, values: unknown[] = []) {
        calls.push({ text, values });
        return { rowCount: rows.length, rows };
      },
    },
  };
}

function req(qs: string) {
  return new Request(new URL(`http://localhost/api/skills${qs}`));
}

beforeEach(() => __setPoolForTests(null));

const dbRows = [
  {
    slug: 'action-converter',
    name: 'Action Converter',
    description: 'desc',
    category: 'productivity',
    tags: [],
  },
];

describe('GET /api/skills', () => {
  it('returns { skills } mapped to the Skill shape', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      skills: [
        {
          slug: 'action-converter',
          name: 'Action Converter',
          description: 'desc',
          category: 'productivity',
          tags: [],
        },
      ],
    });
  });

  it('adds a category filter param when ?category= is present', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?category=productivity'));
    expect(c.calls[0].text).toContain('category =');
    expect(c.calls[0].values).toContain('productivity');
  });

  it('adds an ILIKE search on name/description when ?q= is present', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?q=tweet'));
    expect(c.calls[0].text).toContain('ILIKE');
    expect(c.calls[0].values).toContain('%tweet%');
  });

  it('combines category and q filters', async () => {
    const c = capturePool(dbRows);
    __setPoolForTests(c.pool);
    await GET(req('?category=social&q=buzz'));
    expect(c.calls[0].values).toEqual(expect.arrayContaining(['social', '%buzz%']));
  });
});
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test skills.route
```
Expected FAIL output contains: `Cannot find module '../app/api/skills/route'`.

- [ ] **Step 3: Create row-coercion helpers `apps/web/lib/rows.ts`** (full contents) — normalizes pg jsonb/bigint values into the SHARED response types:
```ts
import type { Persona } from '@aeonomy/shared';

export interface Skill {
  slug: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
}

export interface AgentSummary {
  agentId: string;
  handle: string;
  owner: string;
  wallet: string;
  skills: string[];
  createdAt: number;
}

export interface AgentDetail extends AgentSummary {
  manifestHash: string;
  manifestCid: string | null;
  configHash: string;
  persona: Persona | null;
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asPersona(v: unknown): Persona | null {
  let obj: unknown = v;
  if (typeof v === 'string') {
    try {
      obj = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === 'object') {
    const p = obj as Record<string, unknown>;
    if (
      typeof p.displayName === 'string' &&
      typeof p.bio === 'string' &&
      typeof p.avatarSeed === 'string'
    ) {
      return { displayName: p.displayName, bio: p.bio, avatarSeed: p.avatarSeed };
    }
  }
  return null;
}

export function toSkill(row: Record<string, unknown>): Skill {
  return {
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    category: row.category === null || row.category === undefined ? null : String(row.category),
    tags: asArray(row.tags),
  };
}

export function toAgentSummary(row: Record<string, unknown>): AgentSummary {
  return {
    agentId: String(row.agent_id),
    handle: String(row.handle),
    owner: String(row.owner),
    wallet: String(row.wallet),
    skills: asArray(row.skills),
    createdAt: Number(row.created_at),
  };
}

export function toAgentDetail(row: Record<string, unknown>): AgentDetail {
  return {
    ...toAgentSummary(row),
    manifestHash: String(row.manifest_hash),
    manifestCid:
      row.manifest_cid === null || row.manifest_cid === undefined
        ? null
        : String(row.manifest_cid),
    configHash: String(row.config_hash),
    persona: asPersona(row.persona),
  };
}
```

- [ ] **Step 4: Create `apps/web/app/api/skills/route.ts`** (full contents) — dynamic WHERE built with positional params:
```ts
import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { toSkill } from '../../../lib/rows';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const q = url.searchParams.get('q');

  const where: string[] = [];
  const values: unknown[] = [];

  if (category) {
    values.push(category);
    where.push(`category = $${values.length}`);
  }
  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(`(name ILIKE ${p} OR description ILIKE ${p})`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT slug, name, description, category, tags
               FROM skills ${whereSql}
               ORDER BY name ASC`;

  const pool = getPool();
  const res = await pool.query(sql, values);
  return NextResponse.json({ skills: res.rows.map(toSkill) });
}
```

- [ ] **Step 5: Re-run the test and watch it PASS:**
```
pnpm --filter @aeonomy/web test skills.route
```
Expected PASS output contains: `Tests  4 passed (4)`.

- [ ] **Step 6: Commit:**
```
git add apps/web/lib/rows.ts apps/web/app/api/skills/route.ts apps/web/test/skills.route.test.ts
git commit -m "feat(web): GET /api/skills with category + q filters and row coercion helpers"
```

---

### Task 22: Web API — `GET /api/agents` (list filters/paging) + `GET /api/agents/[handle]` test first

**Files:**
- Create: `apps/web/app/api/agents/route.ts`
- Create: `apps/web/app/api/agents/[handle]/route.ts`
- Test: `apps/web/test/agents-list.route.test.ts`
- Test: `apps/web/test/agent-detail.route.test.ts`

- [ ] **Step 1: Write the FAILING list test `apps/web/test/agents-list.route.test.ts`** (full contents). Response shape `{ agents: AgentSummary[], total: number }`; supports `skill`, `category`, `sort=recent`, `limit`, `offset`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../app/api/agents/route';
import { __setPoolForTests } from '../lib/db';

interface Call { text: string; values: unknown[] }

function multiPool(resultsByCall: { rowCount: number; rows: Record<string, unknown>[] }[]) {
  const calls: Call[] = [];
  let i = 0;
  return {
    calls,
    pool: {
      async query(text: string, values: unknown[] = []) {
        calls.push({ text, values });
        const r = resultsByCall[i] ?? { rowCount: 0, rows: [] };
        i += 1;
        return r;
      },
    },
  };
}

function req(qs: string) {
  return new Request(new URL(`http://localhost/api/agents${qs}`));
}

beforeEach(() => __setPoolForTests(null));

const agentRow = {
  agent_id: '1',
  owner: '0x1111111111111111111111111111111111111111',
  wallet: '0x2222222222222222222222222222222222222222',
  handle: 'satoshi',
  skills: ['action-converter'],
  created_at: '1700000000',
};

describe('GET /api/agents', () => {
  it('returns { agents, total } with summaries and count', async () => {
    const c = multiPool([
      { rowCount: 1, rows: [agentRow] },
      { rowCount: 1, rows: [{ total: '1' }] },
    ]);
    __setPoolForTests(c.pool);
    const res = await GET(req(''));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.agents).toEqual([
      {
        agentId: '1',
        handle: 'satoshi',
        owner: '0x1111111111111111111111111111111111111111',
        wallet: '0x2222222222222222222222222222222222222222',
        skills: ['action-converter'],
        createdAt: 1700000000,
      },
    ]);
  });

  it('filters by skill using a jsonb containment param', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?skill=agent-buzz'));
    expect(c.calls[0].text).toContain('skills @>');
    expect(c.calls[0].values).toContain(JSON.stringify(['agent-buzz']));
  });

  it('joins skills->skills table when filtering by category', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?category=social'));
    expect(c.calls[0].text).toContain('category');
    expect(c.calls[0].values).toContain('social');
  });

  it('applies limit and offset (defaults limit=24, offset=0) and recent sort', async () => {
    const c = multiPool([
      { rowCount: 0, rows: [] },
      { rowCount: 1, rows: [{ total: '0' }] },
    ]);
    __setPoolForTests(c.pool);
    await GET(req('?sort=recent&limit=5&offset=10'));
    expect(c.calls[0].text).toContain('ORDER BY created_at DESC');
    expect(c.calls[0].values).toEqual(expect.arrayContaining([5, 10]));
  });
});
```

- [ ] **Step 2: Run the list test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test agents-list.route
```
Expected FAIL output contains: `Cannot find module '../app/api/agents/route'`.

- [ ] **Step 3: Create `apps/web/app/api/agents/route.ts`** (full contents). `skill` uses jsonb `@>`; `category` resolves matching slugs from `skills` then containment via `?|`-style OR; paging + recent sort:
```ts
import { NextResponse } from 'next/server';
import { getPool } from '../../../lib/db';
import { toAgentSummary } from '../../../lib/rows';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const skill = url.searchParams.get('skill');
  const category = url.searchParams.get('category');
  const sort = url.searchParams.get('sort') ?? 'recent';

  let limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  let offset = Number(url.searchParams.get('offset') ?? 0);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const pool = getPool();
  const where: string[] = [];
  const values: unknown[] = [];

  if (skill) {
    values.push(JSON.stringify([skill]));
    where.push(`a.skills @> $${values.length}::jsonb`);
  }

  if (category) {
    // Resolve slugs in the category, then require overlap with the agent's skills.
    values.push(category);
    where.push(
      `EXISTS (
         SELECT 1 FROM skills s
         WHERE s.category = $${values.length}
           AND a.skills @> to_jsonb(s.slug)
       )`,
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = sort === 'recent' ? 'ORDER BY created_at DESC' : 'ORDER BY agent_id ASC';

  // Page query
  const pageValues = [...values, limit, offset];
  const limitParam = `$${pageValues.length - 1}`;
  const offsetParam = `$${pageValues.length}`;
  const pageSql = `SELECT a.agent_id, a.owner, a.wallet, a.handle, a.skills, a.created_at
                   FROM agents a
                   ${whereSql}
                   ${orderSql}
                   LIMIT ${limitParam} OFFSET ${offsetParam}`;
  const pageRes = await pool.query(pageSql, pageValues);

  // Count query (same filters, no paging)
  const countSql = `SELECT COUNT(*)::text AS total FROM agents a ${whereSql}`;
  const countRes = await pool.query(countSql, values);
  const total = Number(countRes.rows[0]?.total ?? 0);

  return NextResponse.json({
    agents: pageRes.rows.map(toAgentSummary),
    total,
  });
}
```

- [ ] **Step 4: Re-run the list test and watch it PASS:**
```
pnpm --filter @aeonomy/web test agents-list.route
```
Expected PASS output contains: `Tests  4 passed (4)`.

- [ ] **Step 5: Write the FAILING detail test `apps/web/test/agent-detail.route.test.ts`** (full contents). Response `{ agent: AgentDetail }`, 404 if missing:
```ts
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
```

- [ ] **Step 6: Run the detail test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test agent-detail.route
```
Expected FAIL output contains: `Cannot find module '../app/api/agents/[handle]/route'`.

- [ ] **Step 7: Create `apps/web/app/api/agents/[handle]/route.ts`** (full contents). Next.js 15 dynamic params are async (`params: Promise<...>`):
```ts
import { NextResponse } from 'next/server';
import { getPool } from '../../../../lib/db';
import { toAgentDetail } from '../../../../lib/rows';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await context.params;
  const pool = getPool();
  const res = await pool.query(
    `SELECT agent_id, owner, wallet, handle, skills, created_at,
            manifest_hash, manifest_cid, config_hash, persona
     FROM agents WHERE handle = $1 LIMIT 1`,
    [handle],
  );
  if ((res.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 });
  }
  return NextResponse.json({ agent: toAgentDetail(res.rows[0]) });
}
```

- [ ] **Step 8: Re-run the detail test and watch it PASS:**
```
pnpm --filter @aeonomy/web test agent-detail.route
```
Expected PASS output contains: `Tests  2 passed (2)`.

- [ ] **Step 9: Commit:**
```
git add apps/web/app/api/agents/route.ts apps/web/app/api/agents/[handle]/route.ts apps/web/test/agents-list.route.test.ts apps/web/test/agent-detail.route.test.ts
git commit -m "feat(web): GET /api/agents list (filters/paging) + GET /api/agents/[handle]"
```

---

### Task 23: Web API — `POST /api/manifests` (Pinata pin -> { cid, manifestHash }) test first + full suite green

**Files:**
- Create: `apps/web/lib/pinata.ts`
- Create: `apps/web/app/api/manifests/route.ts`
- Test: `apps/web/test/manifests.route.test.ts`

- [ ] **Step 1: Write the FAILING test `apps/web/test/manifests.route.test.ts`** (full contents). Body `{ manifest: Manifest }`; pins via Pinata `pinJSONToIPFS` using `PINATA_JWT`; returns `{ cid, manifestHash }` where `manifestHash = cidToBytes32(cid)` from `@aeonomy/shared`. We inject a fake fetch via the pinata module's test seam:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/manifests/route';
import { __setPinataFetchForTests } from '../lib/pinata';
import { cidToBytes32 } from '@aeonomy/shared';

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
```

- [ ] **Step 2: Run the test and watch it FAIL:**
```
pnpm --filter @aeonomy/web test manifests.route
```
Expected FAIL output contains: `Cannot find module '../lib/pinata'`.

- [ ] **Step 3: Create `apps/web/lib/pinata.ts`** (full contents) — wraps `pinJSONToIPFS` with a fetch test seam:
```ts
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
```

- [ ] **Step 4: Create `apps/web/app/api/manifests/route.ts`** (full contents):
```ts
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
```

- [ ] **Step 5: Re-run the manifests test and watch it PASS:**
```
pnpm --filter @aeonomy/web test manifests.route
```
Expected PASS output contains: `Tests  3 passed (3)`.

- [ ] **Step 6: Run the ENTIRE backend suite across all three packages to confirm the phase is green end-to-end:**
```
pnpm --filter @aeonomy/scripts test
pnpm --filter @aeonomy/indexer test
pnpm --filter @aeonomy/web test
```
Expected: scripts `Test Files  2 passed (2)`; indexer `Test Files  3 passed (3)`; web shows all route + handle test files passing (`handle.test`, `handle-available.route`, `skills.route`, `agents-list.route`, `agent-detail.route`, `manifests.route`).

- [ ] **Step 7: Type-check the web package compiles cleanly:**
```
pnpm --filter @aeonomy/web exec tsc --noEmit
```
Expected: no output, exit code 0.

- [ ] **Step 8: Commit:**
```
git add apps/web/lib/pinata.ts apps/web/app/api/manifests/route.ts apps/web/test/manifests.route.test.ts
git commit -m "feat(web): POST /api/manifests pins via Pinata -> { cid, manifestHash }"
```

## Phase 3: Frontend (Next.js 15 App Router)

> **Scope:** the `apps/web` UI layer — wagmi/RainbowKit/viem providers, env wiring, contract-write + predicted-wallet hooks, the `/create` wizard, the `/agents` gallery, and the `/agents/[handle]` profile. The read API route handlers (`/api/skills`, `/api/agents`, `/api/agents/[handle]`, `/api/agents/handle-available`, `/api/manifests`) and the Postgres-backed data layer were built in earlier phases; this phase **consumes** them over HTTP. Solidity + indexer are done.
>
> **Consumed from `packages/shared` (built in earlier phases — import VERBATIM, do not redefine):**
> - `computeSalt(owner, handle): bigint`
> - `computeConfigHash(config: object): 0xstring`
> - `predictWallet(publicClient, owner, handle): Promise<0xstring>`
> - `cidToBytes32`, `bytes32ToCidV0`
> - `AGENT_REGISTRY_ABI` (ABI export), `LIGHT_ACCOUNT_FACTORY_ABI`, and address constants
> - Types: `Manifest`, `Persona`, `Skill`, `AgentSummary`, `AgentDetail`
>
> These are imported as `@aeonomy/shared`. If an earlier phase used a different package name, substitute it consistently — but DO NOT change the symbol names above.
>
> **Aesthetic:** this phase ships **functional, minimally-styled** components (plain Tailwind utility classes, semantic markup, one neutral CSS-variable token file as a hook). Detailed visual design is produced at build time by the `frontend-design` skill (see **Task 33**). Do NOT hardcode a generic theme, a purple gradient, or shadcn default dark mode.

### Task 24: Scaffold `apps/web` Next.js 15 app + Tailwind + Vitest/RTL

**Files:**
- Create `apps/web/package.json`
- Create `apps/web/next.config.mjs`
- Create `apps/web/tsconfig.json`
- Create `apps/web/postcss.config.mjs`
- Create `apps/web/tailwind.config.ts`
- Create `apps/web/vitest.config.ts`
- Create `apps/web/vitest.setup.ts`
- Create `apps/web/.env.local.example`
- Create `apps/web/app/globals.css`
- Create `apps/web/app/layout.tsx`
- Create `apps/web/app/page.tsx`
- Create `apps/web/src/test/smoke.test.ts` (Test)

- [ ] **Step 1: Create `apps/web/package.json`.**
  ```json
  {
    "name": "@aeonomy/web",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint",
      "typecheck": "tsc --noEmit",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "dependencies": {
      "@aeonomy/shared": "workspace:*",
      "@rainbow-me/rainbowkit": "^2.1.0",
      "@tanstack/react-query": "^5.50.0",
      "next": "15.0.0",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "viem": "^2.17.0",
      "wagmi": "^2.12.0"
    },
    "devDependencies": {
      "@testing-library/jest-dom": "^6.4.6",
      "@testing-library/react": "^16.0.0",
      "@testing-library/user-event": "^14.5.2",
      "@types/node": "^20.14.0",
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      "autoprefixer": "^10.4.19",
      "jsdom": "^24.1.0",
      "postcss": "^8.4.39",
      "tailwindcss": "^3.4.4",
      "typescript": "^5.5.0",
      "vitest": "^2.0.0"
    }
  }
  ```

- [ ] **Step 2: Create `apps/web/next.config.mjs`.**
  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@aeonomy/shared"],
  };

  export default nextConfig;
  ```

- [ ] **Step 3: Create `apps/web/tsconfig.json`.**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["dom", "dom.iterable", "ES2022"],
      "allowJs": false,
      "skipLibCheck": true,
      "strict": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve",
      "incremental": true,
      "types": ["vitest/globals", "@testing-library/jest-dom"],
      "plugins": [{ "name": "next" }],
      "baseUrl": ".",
      "paths": { "@/*": ["./*"] }
    },
    "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  }
  ```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`.**
  ```js
  export default {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  };
  ```

- [ ] **Step 5: Create `apps/web/tailwind.config.ts`.** Minimal config that maps to CSS variables so the `frontend-design` skill can re-theme later without touching components.
  ```ts
  import type { Config } from "tailwindcss";

  const config: Config = {
    content: [
      "./app/**/*.{ts,tsx}",
      "./src/**/*.{ts,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          surface: "var(--color-surface)",
          ink: "var(--color-ink)",
          muted: "var(--color-muted)",
          accent: "var(--color-accent)",
          line: "var(--color-line)",
        },
      },
    },
    plugins: [],
  };

  export default config;
  ```

- [ ] **Step 6: Create `apps/web/app/globals.css`.** Neutral, non-generic tokens (NOT dark mode, NO purple gradient). This file is the explicit re-theming hook for Task 33.
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* AEONOMY design tokens — placeholder neutral palette.
     The frontend-design skill (Task 33) overrides these values + adds type/spacing.
     Do NOT add a purple gradient or shadcn default dark theme here. */
  :root {
    --color-surface: #faf8f3;
    --color-ink: #1a1a17;
    --color-muted: #6b6960;
    --color-accent: #1f6f5c;
    --color-line: #e4e0d6;
  }

  html,
  body {
    background: var(--color-surface);
    color: var(--color-ink);
  }

  * {
    box-sizing: border-box;
  }
  ```

- [ ] **Step 7: Create `apps/web/app/layout.tsx`.** Root layout pulls in providers (created in Task 25).
  ```tsx
  import type { Metadata } from "next";
  import "./globals.css";
  import { Providers } from "../src/providers";

  export const metadata: Metadata = {
    title: "Aeonomy",
    description: "Spawn on-chain agents with deterministic smart wallets.",
  };

  export default function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html lang="en">
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 8: Create `apps/web/app/page.tsx`.** Trivial landing page with links into the two flows.
  ```tsx
  import Link from "next/link";

  export default function HomePage() {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Aeonomy</h1>
        <p className="mt-2 text-muted">
          Spawn on-chain agents with deterministic smart wallets.
        </p>
        <nav className="mt-8 flex gap-4">
          <Link className="underline" href="/create">
            Create an agent
          </Link>
          <Link className="underline" href="/agents">
            Browse agents
          </Link>
        </nav>
      </main>
    );
  }
  ```

- [ ] **Step 9: Create `apps/web/vitest.config.ts`.**
  ```ts
  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";

  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
    },
  });
  ```

- [ ] **Step 10: Create `apps/web/vitest.setup.ts`.**
  ```ts
  import "@testing-library/jest-dom/vitest";
  ```

- [ ] **Step 11: Create `apps/web/.env.local.example`.** Exactly the env vars from the shared interface that the frontend needs (public + the API-backing ones the route handlers read are in apps/web too, but only NEXT_PUBLIC_* reach the client bundle).
  ```bash
  # Client-exposed (browser): chain + contract + walletconnect
  NEXT_PUBLIC_REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
  NEXT_PUBLIC_WALLETCONNECT_ID=replace_me

  # Server-only (used by route handlers built in earlier phases)
  BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
  REGISTRY_ADDRESS=0x0000000000000000000000000000000000000000
  PINATA_JWT=replace_me
  IPFS_GATEWAY=gateway.pinata.cloud
  DATABASE_URL=postgres://aeon:aeon@localhost:5432/aeon
  ```

- [ ] **Step 12: Write the scaffold smoke test `apps/web/src/test/smoke.test.ts`.**
  ```ts
  import { describe, it, expect } from "vitest";

  describe("scaffold", () => {
    it("runs the vitest+jsdom toolchain", () => {
      const el = document.createElement("div");
      el.textContent = "aeonomy";
      expect(el.textContent).toBe("aeonomy");
    });
  });
  ```

- [ ] **Step 13: Run the smoke test — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test
  ```
  Expected: `Test Files  1 passed (1)` / `Tests  1 passed (1)`.

- [ ] **Step 14: Commit.**
  ```bash
  git add apps/web && git commit -m "feat(web): scaffold Next.js 15 app + Tailwind + Vitest/RTL"
  ```

---

### Task 25: Providers — wagmi 2 + RainbowKit 2 + viem `baseSepolia` + QueryClient

**Files:**
- Create `apps/web/src/wagmi.ts`
- Create `apps/web/src/providers.tsx`
- Create `apps/web/src/env.ts`
- Create `apps/web/src/env.test.ts` (Test)

- [ ] **Step 1: Write the failing env test `apps/web/src/env.test.ts`.** Asserts the client env reader validates `NEXT_PUBLIC_REGISTRY_ADDRESS` shape and surfaces `walletConnectId`.
  ```ts
  import { describe, it, expect } from "vitest";
  import { readClientEnv } from "./env";

  describe("readClientEnv", () => {
    it("returns a checksummable registry address and wc id", () => {
      const env = readClientEnv({
        NEXT_PUBLIC_REGISTRY_ADDRESS: "0x00000000000000000000000000000000000000aa",
        NEXT_PUBLIC_WALLETCONNECT_ID: "wc-123",
      });
      expect(env.registryAddress).toBe(
        "0x00000000000000000000000000000000000000aa",
      );
      expect(env.walletConnectId).toBe("wc-123");
    });

    it("throws when registry address is malformed", () => {
      expect(() =>
        readClientEnv({
          NEXT_PUBLIC_REGISTRY_ADDRESS: "nope",
          NEXT_PUBLIC_WALLETCONNECT_ID: "wc-123",
        }),
      ).toThrow(/NEXT_PUBLIC_REGISTRY_ADDRESS/);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL (module missing).**
  ```bash
  pnpm --filter @aeonomy/web test src/env.test.ts
  ```
  Expected: `Failed to resolve import "./env"` / `Cannot find module './env'`.

- [ ] **Step 3: Implement `apps/web/src/env.ts`.** Pure, injectable reader (testable without `process.env`).
  ```ts
  import type { Address } from "viem";

  export interface ClientEnv {
    registryAddress: Address;
    walletConnectId: string;
  }

  interface RawClientEnv {
    NEXT_PUBLIC_REGISTRY_ADDRESS?: string;
    NEXT_PUBLIC_WALLETCONNECT_ID?: string;
  }

  const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

  export function readClientEnv(raw: RawClientEnv): ClientEnv {
    const addr = raw.NEXT_PUBLIC_REGISTRY_ADDRESS;
    if (!addr || !ADDRESS_RE.test(addr)) {
      throw new Error(
        `NEXT_PUBLIC_REGISTRY_ADDRESS missing or malformed: ${String(addr)}`,
      );
    }
    const wc = raw.NEXT_PUBLIC_WALLETCONNECT_ID;
    if (!wc) {
      throw new Error("NEXT_PUBLIC_WALLETCONNECT_ID missing");
    }
    return { registryAddress: addr as Address, walletConnectId: wc };
  }

  export const clientEnv: ClientEnv = readClientEnv({
    NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
    NEXT_PUBLIC_WALLETCONNECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
  });
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/env.test.ts
  ```
  Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Implement `apps/web/src/wagmi.ts`.** Single wagmi config, chain = `baseSepolia`, RainbowKit default connectors.
  ```ts
  import { getDefaultConfig } from "@rainbow-me/rainbowkit";
  import { baseSepolia } from "viem/chains";
  import { http } from "wagmi";
  import { clientEnv } from "./env";

  export const wagmiConfig = getDefaultConfig({
    appName: "Aeonomy",
    projectId: clientEnv.walletConnectId,
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http(),
    },
    ssr: true,
  });
  ```

- [ ] **Step 6: Implement `apps/web/src/providers.tsx`.** Client component composing wagmi + react-query + RainbowKit.
  ```tsx
  "use client";

  import "@rainbow-me/rainbowkit/styles.css";
  import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState } from "react";
  import { WagmiProvider } from "wagmi";
  import { wagmiConfig } from "./wagmi";

  export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }
  ```

- [ ] **Step 7: Typecheck to confirm the provider graph compiles.**
  ```bash
  pnpm --filter @aeonomy/web typecheck
  ```
  Expected: no errors (exit 0).

- [ ] **Step 8: Commit.**
  ```bash
  git add apps/web/src && git commit -m "feat(web): wagmi/RainbowKit/viem providers + typed client env"
  ```

---

### Task 26: API client helpers + manifest builder (pure logic)

**Files:**
- Create `apps/web/src/lib/api.ts`
- Create `apps/web/src/lib/manifest.ts`
- Create `apps/web/src/lib/manifest.test.ts` (Test)

- [ ] **Step 1: Write the failing test `apps/web/src/lib/manifest.test.ts`.** Covers `buildManifest` (canonical shape) and that `computeConfigHash` from shared is wired to the config object, not the whole manifest.
  ```ts
  import { describe, it, expect } from "vitest";
  import { buildManifest, buildConfig } from "./manifest";
  import { computeConfigHash } from "@aeonomy/shared";

  const OWNER = "0x00000000000000000000000000000000000000aa" as const;

  describe("buildManifest", () => {
    it("produces a version-1 manifest with sorted skills and persona", () => {
      const m = buildManifest({
        handle: "scout-01",
        owner: OWNER,
        skills: ["web-search", "arxiv"],
        persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
        createdAt: 1718000000,
      });
      expect(m.version).toBe(1);
      expect(m.handle).toBe("scout-01");
      expect(m.owner).toBe(OWNER);
      expect(m.skills).toEqual(["arxiv", "web-search"]); // deterministic order
      expect(m.persona.displayName).toBe("Scout");
      expect(m.createdAt).toBe(1718000000);
    });
  });

  describe("buildConfig", () => {
    it("hashes persona+skills deterministically and excludes volatile fields", () => {
      const cfgA = buildConfig({
        handle: "scout-01",
        skills: ["web-search", "arxiv"],
        persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
      });
      const cfgB = buildConfig({
        handle: "scout-01",
        skills: ["arxiv", "web-search"], // different input order
        persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
      });
      expect(computeConfigHash(cfgA)).toBe(computeConfigHash(cfgB));
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/lib/manifest.test.ts
  ```
  Expected: `Cannot find module './manifest'`.

- [ ] **Step 3: Implement `apps/web/src/lib/manifest.ts`.** Pure builders. Skills are sorted so the config hash is stable regardless of pick order.
  ```ts
  import type { Address } from "viem";
  import type { Manifest, Persona } from "@aeonomy/shared";

  export interface ConfigInput {
    handle: string;
    skills: string[];
    persona: Persona;
  }

  /** Canonical config object hashed into configHash (no timestamps/owner). */
  export interface AgentConfig {
    handle: string;
    skills: string[];
    persona: Persona;
  }

  export function buildConfig(input: ConfigInput): AgentConfig {
    return {
      handle: input.handle,
      skills: [...input.skills].sort(),
      persona: {
        displayName: input.persona.displayName,
        bio: input.persona.bio,
        avatarSeed: input.persona.avatarSeed,
      },
    };
  }

  export interface ManifestInput {
    handle: string;
    owner: Address;
    skills: string[];
    persona: Persona;
    createdAt: number;
  }

  export function buildManifest(input: ManifestInput): Manifest {
    return {
      version: 1,
      handle: input.handle,
      owner: input.owner,
      persona: {
        displayName: input.persona.displayName,
        bio: input.persona.bio,
        avatarSeed: input.persona.avatarSeed,
      },
      skills: [...input.skills].sort(),
      createdAt: input.createdAt,
    };
  }
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/lib/manifest.test.ts
  ```
  Expected: `Tests  2 passed (2)`.

- [ ] **Step 5: Implement `apps/web/src/lib/api.ts`.** Thin typed fetchers for the read API (consumes the route handlers from earlier phases VERBATIM). Browser-relative URLs.
  ```ts
  import type {
    Skill,
    AgentSummary,
    AgentDetail,
    Manifest,
  } from "@aeonomy/shared";
  import type { Address } from "viem";

  async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${res.status}`);
    }
    return (await res.json()) as T;
  }

  export async function fetchSkills(params?: {
    category?: string;
    q?: string;
  }): Promise<Skill[]> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const data = await getJson<{ skills: Skill[] }>(`/api/skills${suffix}`);
    return data.skills;
  }

  export async function fetchAgents(params?: {
    skill?: string;
    category?: string;
    sort?: "recent";
    limit?: number;
    offset?: number;
  }): Promise<{ agents: AgentSummary[]; total: number }> {
    const qs = new URLSearchParams();
    if (params?.skill) qs.set("skill", params.skill);
    if (params?.category) qs.set("category", params.category);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return getJson<{ agents: AgentSummary[]; total: number }>(
      `/api/agents${suffix}`,
    );
  }

  export async function fetchAgent(handle: string): Promise<AgentDetail | null> {
    const res = await fetch(`/api/agents/${encodeURIComponent(handle)}`, {
      headers: { accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET /api/agents/${handle} -> ${res.status}`);
    const data = (await res.json()) as { agent: AgentDetail };
    return data.agent;
  }

  export interface HandleAvailability {
    available: boolean;
    reason?: string;
  }

  export async function fetchHandleAvailable(
    handle: string,
  ): Promise<HandleAvailability> {
    return getJson<HandleAvailability>(
      `/api/agents/handle-available?handle=${encodeURIComponent(handle)}`,
    );
  }

  export async function pinManifest(
    manifest: Manifest,
  ): Promise<{ cid: string; manifestHash: Address }> {
    const res = await fetch("/api/manifests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manifest }),
    });
    if (!res.ok) throw new Error(`POST /api/manifests -> ${res.status}`);
    return (await res.json()) as { cid: string; manifestHash: Address };
  }
  ```

- [ ] **Step 6: Typecheck.**
  ```bash
  pnpm --filter @aeonomy/web typecheck
  ```
  Expected: exit 0.

- [ ] **Step 7: Commit.**
  ```bash
  git add apps/web/src/lib && git commit -m "feat(web): typed read-API client + pure manifest/config builders"
  ```

---

### Task 27: `useSpawnAgent` and `usePredictedWallet` hooks

**Files:**
- Create `apps/web/src/hooks/useSpawnAgent.ts`
- Create `apps/web/src/hooks/usePredictedWallet.ts`
- Create `apps/web/src/hooks/spawn-args.ts`
- Create `apps/web/src/hooks/spawn-args.test.ts` (Test)

> The contract write is `spawnAgent(handle, manifestHash, configHash)` — **three** args; the salt is computed inside the contract, NOT passed. The predicted wallet is read off-chain via `predictWallet()` (which internally uses `computeSalt`).

- [ ] **Step 1: Write the failing test `apps/web/src/hooks/spawn-args.test.ts`.** Tests the pure arg-builder that the hook delegates to.
  ```ts
  import { describe, it, expect } from "vitest";
  import { buildSpawnArgs } from "./spawn-args";

  describe("buildSpawnArgs", () => {
    it("returns exactly [handle, manifestHash, configHash] in order", () => {
      const args = buildSpawnArgs({
        handle: "scout-01",
        manifestHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        configHash:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
      });
      expect(args).toEqual([
        "scout-01",
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      ]);
      expect(args).toHaveLength(3);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/hooks/spawn-args.test.ts
  ```
  Expected: `Cannot find module './spawn-args'`.

- [ ] **Step 3: Implement `apps/web/src/hooks/spawn-args.ts`.**
  ```ts
  import type { Hex } from "viem";

  export interface SpawnArgsInput {
    handle: string;
    manifestHash: Hex;
    configHash: Hex;
  }

  /** Tuple matching AgentRegistry.spawnAgent(string,bytes32,bytes32). */
  export function buildSpawnArgs(
    input: SpawnArgsInput,
  ): readonly [string, Hex, Hex] {
    return [input.handle, input.manifestHash, input.configHash] as const;
  }
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/hooks/spawn-args.test.ts
  ```
  Expected: `Tests  1 passed (1)`.

- [ ] **Step 5: Implement `apps/web/src/hooks/useSpawnAgent.ts`.** Wraps wagmi `useWriteContract` + `useWaitForTransactionReceipt`. Parses `agentId`/`wallet` from the `AgentSpawned` log on success.
  ```ts
  "use client";

  import { useCallback } from "react";
  import {
    useWriteContract,
    useWaitForTransactionReceipt,
  } from "wagmi";
  import { decodeEventLog, type Hex, type Address } from "viem";
  import { AGENT_REGISTRY_ABI } from "@aeonomy/shared";
  import { clientEnv } from "../env";
  import { buildSpawnArgs } from "./spawn-args";

  export interface SpawnInput {
    handle: string;
    manifestHash: Hex;
    configHash: Hex;
  }

  export interface SpawnedResult {
    agentId: bigint;
    wallet: Address;
  }

  export function useSpawnAgent() {
    const {
      writeContractAsync,
      data: txHash,
      isPending: isWriting,
      error: writeError,
      reset,
    } = useWriteContract();

    const {
      data: receipt,
      isLoading: isConfirming,
      isSuccess: isConfirmed,
      error: receiptError,
    } = useWaitForTransactionReceipt({ hash: txHash });

    const spawn = useCallback(
      async (input: SpawnInput): Promise<Hex> => {
        return writeContractAsync({
          address: clientEnv.registryAddress,
          abi: AGENT_REGISTRY_ABI,
          functionName: "spawnAgent",
          args: buildSpawnArgs(input),
        });
      },
      [writeContractAsync],
    );

    let spawned: SpawnedResult | undefined;
    if (receipt) {
      for (const log of receipt.logs) {
        try {
          const parsed = decodeEventLog({
            abi: AGENT_REGISTRY_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (parsed.eventName === "AgentSpawned") {
            const a = parsed.args as unknown as {
              agentId: bigint;
              wallet: Address;
            };
            spawned = { agentId: a.agentId, wallet: a.wallet };
            break;
          }
        } catch {
          // not our event; skip
        }
      }
    }

    return {
      spawn,
      reset,
      txHash,
      isWriting,
      isConfirming,
      isConfirmed,
      spawned,
      error: writeError ?? receiptError ?? null,
    };
  }
  ```

- [ ] **Step 6: Implement `apps/web/src/hooks/usePredictedWallet.ts`.** Reads `factory.getAddress` via the shared `predictWallet` helper, using wagmi's public client. Debounced by react-query keying on `(owner, handle)`.
  ```ts
  "use client";

  import { useQuery } from "@tanstack/react-query";
  import { usePublicClient } from "wagmi";
  import type { Address } from "viem";
  import { predictWallet } from "@aeonomy/shared";

  export function usePredictedWallet(
    owner: Address | undefined,
    handle: string,
  ) {
    const publicClient = usePublicClient();
    const enabled = Boolean(owner && publicClient && handle.length >= 3);

    return useQuery({
      queryKey: ["predicted-wallet", owner, handle],
      enabled,
      queryFn: async (): Promise<Address> => {
        if (!owner || !publicClient) throw new Error("not ready");
        return predictWallet(publicClient, owner, handle);
      },
      staleTime: 60_000,
    });
  }
  ```

- [ ] **Step 7: Typecheck.**
  ```bash
  pnpm --filter @aeonomy/web typecheck
  ```
  Expected: exit 0.

- [ ] **Step 8: Commit.**
  ```bash
  git add apps/web/src/hooks && git commit -m "feat(web): useSpawnAgent + usePredictedWallet hooks"
  ```

---

### Task 28: Handle-availability state machine (debounce reducer)

**Files:**
- Create `apps/web/src/features/create/handleAvailability.ts`
- Create `apps/web/src/features/create/handleAvailability.test.ts` (Test)

> Pure reducer + format validator so the UI debounce logic is unit-tested without timers in the DOM. Format rules mirror the contract: 3..32 bytes, each char `[a-z0-9-]`, lowercase only.

- [ ] **Step 1: Write the failing test `apps/web/src/features/create/handleAvailability.test.ts`.**
  ```ts
  import { describe, it, expect } from "vitest";
  import {
    validateHandleFormat,
    availabilityReducer,
    initialAvailabilityState,
    type AvailabilityState,
  } from "./handleAvailability";

  describe("validateHandleFormat", () => {
    it("rejects too short", () => {
      expect(validateHandleFormat("ab")).toEqual({
        ok: false,
        reason: "Handle must be 3-32 characters.",
      });
    });
    it("rejects too long", () => {
      expect(validateHandleFormat("a".repeat(33))).toEqual({
        ok: false,
        reason: "Handle must be 3-32 characters.",
      });
    });
    it("rejects uppercase and bad chars", () => {
      expect(validateHandleFormat("Scout").ok).toBe(false);
      expect(validateHandleFormat("scout_01").ok).toBe(false);
      expect(validateHandleFormat("sco ut").ok).toBe(false);
    });
    it("accepts lowercase, digits, and hyphen", () => {
      expect(validateHandleFormat("scout-01")).toEqual({ ok: true });
    });
  });

  describe("availabilityReducer", () => {
    it("invalid format short-circuits to invalid", () => {
      const s = availabilityReducer(initialAvailabilityState, {
        type: "input",
        handle: "ab",
      });
      expect(s.status).toBe("invalid");
      expect(s.reason).toBe("Handle must be 3-32 characters.");
    });

    it("valid format moves to checking", () => {
      const s = availabilityReducer(initialAvailabilityState, {
        type: "input",
        handle: "scout-01",
      });
      expect(s.status).toBe("checking");
      expect(s.handle).toBe("scout-01");
    });

    it("resolves available only when handle still matches", () => {
      const checking: AvailabilityState = {
        status: "checking",
        handle: "scout-01",
        reason: undefined,
      };
      const ok = availabilityReducer(checking, {
        type: "result",
        handle: "scout-01",
        available: true,
      });
      expect(ok.status).toBe("available");

      const stale = availabilityReducer(checking, {
        type: "result",
        handle: "old-handle",
        available: true,
      });
      expect(stale.status).toBe("checking"); // ignored stale result
    });

    it("resolves taken with reason", () => {
      const checking: AvailabilityState = {
        status: "checking",
        handle: "scout-01",
        reason: undefined,
      };
      const taken = availabilityReducer(checking, {
        type: "result",
        handle: "scout-01",
        available: false,
        reason: "taken",
      });
      expect(taken.status).toBe("taken");
      expect(taken.reason).toBe("taken");
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/create/handleAvailability.test.ts
  ```
  Expected: `Cannot find module './handleAvailability'`.

- [ ] **Step 3: Implement `apps/web/src/features/create/handleAvailability.ts`.**
  ```ts
  export type AvailabilityStatus =
    | "idle"
    | "invalid"
    | "checking"
    | "available"
    | "taken"
    | "error";

  export interface AvailabilityState {
    status: AvailabilityStatus;
    handle: string;
    reason?: string;
  }

  export const initialAvailabilityState: AvailabilityState = {
    status: "idle",
    handle: "",
    reason: undefined,
  };

  const HANDLE_CHAR_RE = /^[a-z0-9-]+$/;

  export type FormatResult = { ok: true } | { ok: false; reason: string };

  export function validateHandleFormat(handle: string): FormatResult {
    if (handle.length < 3 || handle.length > 32) {
      return { ok: false, reason: "Handle must be 3-32 characters." };
    }
    if (!HANDLE_CHAR_RE.test(handle)) {
      return {
        ok: false,
        reason: "Use lowercase letters, digits, and hyphens only.",
      };
    }
    return { ok: true };
  }

  export type AvailabilityAction =
    | { type: "input"; handle: string }
    | { type: "result"; handle: string; available: boolean; reason?: string }
    | { type: "fail"; handle: string };

  export function availabilityReducer(
    state: AvailabilityState,
    action: AvailabilityAction,
  ): AvailabilityState {
    switch (action.type) {
      case "input": {
        if (action.handle.length === 0) {
          return { status: "idle", handle: "", reason: undefined };
        }
        const fmt = validateHandleFormat(action.handle);
        if (!fmt.ok) {
          return {
            status: "invalid",
            handle: action.handle,
            reason: fmt.reason,
          };
        }
        return { status: "checking", handle: action.handle, reason: undefined };
      }
      case "result": {
        // ignore results for a handle the user has since changed
        if (action.handle !== state.handle) return state;
        if (action.available) {
          return { status: "available", handle: state.handle, reason: undefined };
        }
        return {
          status: "taken",
          handle: state.handle,
          reason: action.reason ?? "Handle is taken.",
        };
      }
      case "fail": {
        if (action.handle !== state.handle) return state;
        return {
          status: "error",
          handle: state.handle,
          reason: "Could not check availability.",
        };
      }
      default:
        return state;
    }
  }
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/create/handleAvailability.test.ts
  ```
  Expected: `Tests  5 passed (5)` (or matching count).

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/src/features/create/handleAvailability.ts apps/web/src/features/create/handleAvailability.test.ts && git commit -m "feat(web): handle-availability format validator + debounce reducer"
  ```

---

### Task 29: Wizard step state machine

**Files:**
- Create `apps/web/src/features/create/wizardMachine.ts`
- Create `apps/web/src/features/create/wizardMachine.test.ts` (Test)

> Drives the 5 steps: `connect -> handle -> skills -> persona -> review`. Guards: can't advance past a step until its data is valid. Pure — no React.

- [ ] **Step 1: Write the failing test `apps/web/src/features/create/wizardMachine.test.ts`.**
  ```ts
  import { describe, it, expect } from "vitest";
  import {
    wizardReducer,
    initialWizardState,
    canAdvance,
    STEPS,
    type WizardState,
  } from "./wizardMachine";

  const OWNER = "0x00000000000000000000000000000000000000aa" as const;

  function valid(): WizardState {
    return {
      step: "review",
      connected: true,
      owner: OWNER,
      handle: "scout-01",
      handleAvailable: true,
      skills: ["arxiv", "web-search"],
      persona: { displayName: "Scout", bio: "finds things", avatarSeed: "scout-01" },
    };
  }

  describe("STEPS order", () => {
    it("is connect -> handle -> skills -> persona -> review", () => {
      expect(STEPS).toEqual([
        "connect",
        "handle",
        "skills",
        "persona",
        "review",
      ]);
    });
  });

  describe("canAdvance guards", () => {
    it("blocks connect until wallet connected", () => {
      expect(canAdvance({ ...initialWizardState, step: "connect" })).toBe(false);
      expect(
        canAdvance({ ...initialWizardState, step: "connect", connected: true, owner: OWNER }),
      ).toBe(true);
    });

    it("blocks handle step until available", () => {
      const base: WizardState = {
        ...initialWizardState,
        step: "handle",
        connected: true,
        owner: OWNER,
        handle: "scout-01",
        handleAvailable: false,
      };
      expect(canAdvance(base)).toBe(false);
      expect(canAdvance({ ...base, handleAvailable: true })).toBe(true);
    });

    it("blocks skills step until at least one skill", () => {
      const base: WizardState = { ...valid(), step: "skills", skills: [] };
      expect(canAdvance(base)).toBe(false);
      expect(canAdvance({ ...base, skills: ["arxiv"] })).toBe(true);
    });

    it("blocks persona step until displayName present", () => {
      const base: WizardState = {
        ...valid(),
        step: "persona",
        persona: { displayName: "", bio: "", avatarSeed: "scout-01" },
      };
      expect(canAdvance(base)).toBe(false);
      expect(
        canAdvance({
          ...base,
          persona: { displayName: "Scout", bio: "", avatarSeed: "scout-01" },
        }),
      ).toBe(true);
    });
  });

  describe("wizardReducer navigation", () => {
    it("next advances only when guard passes", () => {
      const s0: WizardState = {
        ...initialWizardState,
        step: "connect",
        connected: true,
        owner: OWNER,
      };
      const s1 = wizardReducer(s0, { type: "next" });
      expect(s1.step).toBe("handle");
    });

    it("next is a no-op when guard fails", () => {
      const s0: WizardState = { ...initialWizardState, step: "connect" };
      const s1 = wizardReducer(s0, { type: "next" });
      expect(s1.step).toBe("connect");
    });

    it("back moves to previous step and never below connect", () => {
      const atHandle: WizardState = { ...valid(), step: "handle" };
      expect(wizardReducer(atHandle, { type: "back" }).step).toBe("connect");
      const atConnect: WizardState = { ...valid(), step: "connect" };
      expect(wizardReducer(atConnect, { type: "back" }).step).toBe("connect");
    });

    it("setHandle resets availability to unknown", () => {
      const s = wizardReducer(valid(), { type: "setHandle", handle: "new-name" });
      expect(s.handle).toBe("new-name");
      expect(s.handleAvailable).toBe(false);
    });

    it("toggleSkill adds then removes", () => {
      const added = wizardReducer({ ...valid(), skills: [] }, {
        type: "toggleSkill",
        slug: "arxiv",
      });
      expect(added.skills).toEqual(["arxiv"]);
      const removed = wizardReducer(added, { type: "toggleSkill", slug: "arxiv" });
      expect(removed.skills).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/create/wizardMachine.test.ts
  ```
  Expected: `Cannot find module './wizardMachine'`.

- [ ] **Step 3: Implement `apps/web/src/features/create/wizardMachine.ts`.**
  ```ts
  import type { Address } from "viem";
  import type { Persona } from "@aeonomy/shared";

  export const STEPS = [
    "connect",
    "handle",
    "skills",
    "persona",
    "review",
  ] as const;

  export type WizardStep = (typeof STEPS)[number];

  export interface WizardState {
    step: WizardStep;
    connected: boolean;
    owner?: Address;
    handle: string;
    handleAvailable: boolean;
    skills: string[];
    persona: Persona;
  }

  export const initialWizardState: WizardState = {
    step: "connect",
    connected: false,
    owner: undefined,
    handle: "",
    handleAvailable: false,
    skills: [],
    persona: { displayName: "", bio: "", avatarSeed: "" },
  };

  export function canAdvance(state: WizardState): boolean {
    switch (state.step) {
      case "connect":
        return state.connected && Boolean(state.owner);
      case "handle":
        return state.handle.length >= 3 && state.handleAvailable;
      case "skills":
        return state.skills.length >= 1;
      case "persona":
        return state.persona.displayName.trim().length > 0;
      case "review":
        return true;
      default:
        return false;
    }
  }

  export type WizardAction =
    | { type: "next" }
    | { type: "back" }
    | { type: "setConnected"; connected: boolean; owner?: Address }
    | { type: "setHandle"; handle: string }
    | { type: "setHandleAvailable"; available: boolean }
    | { type: "toggleSkill"; slug: string }
    | { type: "setPersona"; persona: Persona };

  function stepIndex(step: WizardStep): number {
    return STEPS.indexOf(step);
  }

  export function wizardReducer(
    state: WizardState,
    action: WizardAction,
  ): WizardState {
    switch (action.type) {
      case "next": {
        if (!canAdvance(state)) return state;
        const idx = stepIndex(state.step);
        const nextIdx = Math.min(idx + 1, STEPS.length - 1);
        return { ...state, step: STEPS[nextIdx] };
      }
      case "back": {
        const idx = stepIndex(state.step);
        const prevIdx = Math.max(idx - 1, 0);
        return { ...state, step: STEPS[prevIdx] };
      }
      case "setConnected":
        return {
          ...state,
          connected: action.connected,
          owner: action.owner,
        };
      case "setHandle":
        return {
          ...state,
          handle: action.handle,
          handleAvailable: false,
          persona:
            state.persona.avatarSeed.length === 0
              ? { ...state.persona, avatarSeed: action.handle }
              : state.persona,
        };
      case "setHandleAvailable":
        return { ...state, handleAvailable: action.available };
      case "toggleSkill": {
        const has = state.skills.includes(action.slug);
        return {
          ...state,
          skills: has
            ? state.skills.filter((s) => s !== action.slug)
            : [...state.skills, action.slug],
        };
      }
      case "setPersona":
        return { ...state, persona: action.persona };
      default:
        return state;
    }
  }
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/create/wizardMachine.test.ts
  ```
  Expected: all tests pass.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web/src/features/create/wizardMachine.ts apps/web/src/features/create/wizardMachine.test.ts && git commit -m "feat(web): create-wizard step state machine + guards"
  ```

---

### Task 30: Shared presentational components — `AgentCard`, `SkillChip`, `AvatarBlob`, formatters

**Files:**
- Create `apps/web/src/components/format.ts`
- Create `apps/web/src/components/format.test.ts` (Test)
- Create `apps/web/src/components/AvatarBlob.tsx`
- Create `apps/web/src/components/SkillChip.tsx`
- Create `apps/web/src/components/AgentCard.tsx`
- Create `apps/web/src/components/AgentCard.test.tsx` (Test)
- Create `apps/web/src/test/fixtures.ts`

- [ ] **Step 1: Create the fixture file `apps/web/src/test/fixtures.ts`.**
  ```ts
  import type { AgentSummary, AgentDetail, Skill } from "@aeonomy/shared";

  export const SKILL_FIXTURES: Skill[] = [
    {
      slug: "web-search",
      name: "Web Search",
      description: "Search the open web.",
      category: "research",
      tags: ["search", "web"],
    },
    {
      slug: "arxiv",
      name: "arXiv",
      description: "Query arXiv papers.",
      category: "research",
      tags: ["papers"],
    },
  ];

  export const AGENT_SUMMARY_FIXTURE: AgentSummary = {
    agentId: 1,
    handle: "scout-01",
    owner: "0x00000000000000000000000000000000000000aa",
    wallet: "0x00000000000000000000000000000000000000bb",
    skills: ["web-search", "arxiv"],
    createdAt: 1718000000,
  };

  export const AGENT_DETAIL_FIXTURE: AgentDetail = {
    ...AGENT_SUMMARY_FIXTURE,
    manifestHash:
      "0x1220000000000000000000000000000000000000000000000000000000000000",
    manifestCid: "QmFakeCidForTestsXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    configHash:
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    persona: {
      displayName: "Scout",
      bio: "Finds things on the web and in papers.",
      avatarSeed: "scout-01",
    },
  };
  ```

- [ ] **Step 2: Write the failing test `apps/web/src/components/format.test.ts`.**
  ```ts
  import { describe, it, expect } from "vitest";
  import { shortAddress, formatCreatedAt, basescanAddressUrl } from "./format";

  describe("shortAddress", () => {
    it("truncates middle", () => {
      expect(shortAddress("0x00000000000000000000000000000000000000bb")).toBe(
        "0x0000…00bb",
      );
    });
    it("returns input when too short", () => {
      expect(shortAddress("0x12")).toBe("0x12");
    });
  });

  describe("formatCreatedAt", () => {
    it("renders a YYYY-MM-DD date from unix seconds (UTC)", () => {
      expect(formatCreatedAt(1718000000)).toBe("2024-06-10");
    });
  });

  describe("basescanAddressUrl", () => {
    it("builds a sepolia basescan link", () => {
      expect(
        basescanAddressUrl("0x00000000000000000000000000000000000000bb"),
      ).toBe(
        "https://sepolia.basescan.org/address/0x00000000000000000000000000000000000000bb",
      );
    });
  });
  ```

- [ ] **Step 3: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/components/format.test.ts
  ```
  Expected: `Cannot find module './format'`.

- [ ] **Step 4: Implement `apps/web/src/components/format.ts`.**
  ```ts
  export function shortAddress(addr: string): string {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  export function formatCreatedAt(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  export function basescanAddressUrl(addr: string): string {
    return `https://sepolia.basescan.org/address/${addr}`;
  }

  export function ipfsUrl(gateway: string, cid: string): string {
    const gw = gateway.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${gw}/ipfs/${cid}`;
  }
  ```

- [ ] **Step 5: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/components/format.test.ts
  ```
  Expected: `Tests  4 passed (4)`.

- [ ] **Step 6: Implement `apps/web/src/components/AvatarBlob.tsx`.** Deterministic SVG from `avatarSeed` — NOT a generic placeholder image. (Visual refinement handled in Task 33; this is a functional default.)
  ```tsx
  function hashSeed(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  export function AvatarBlob({
    seed,
    size = 48,
  }: {
    seed: string;
    size?: number;
  }) {
    const h = hashSeed(seed);
    const hue = h % 360;
    const hue2 = (h >> 3) % 360;
    const r = 6 + (h % 7);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label={`avatar for ${seed}`}
        data-testid="avatar-blob"
      >
        <rect
          width="48"
          height="48"
          rx={r}
          fill={`hsl(${hue} 45% 88%)`}
        />
        <circle
          cx={16 + (h % 16)}
          cy={16 + ((h >> 5) % 16)}
          r={10 + (h % 6)}
          fill={`hsl(${hue2} 55% 55%)`}
        />
      </svg>
    );
  }
  ```

- [ ] **Step 7: Implement `apps/web/src/components/SkillChip.tsx`.**
  ```tsx
  export function SkillChip({ slug }: { slug: string }) {
    return (
      <span
        className="inline-block rounded-full border border-line px-2 py-0.5 text-xs text-muted"
        data-testid="skill-chip"
      >
        {slug}
      </span>
    );
  }
  ```

- [ ] **Step 8: Write the failing test `apps/web/src/components/AgentCard.test.tsx`.**
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render, screen } from "@testing-library/react";
  import { AgentCard } from "./AgentCard";
  import { AGENT_SUMMARY_FIXTURE } from "../test/fixtures";

  describe("AgentCard", () => {
    it("renders handle, short wallet, created date, and skill chips", () => {
      render(<AgentCard agent={AGENT_SUMMARY_FIXTURE} />);

      expect(screen.getByText("scout-01")).toBeInTheDocument();
      expect(screen.getByText("0x0000…00bb")).toBeInTheDocument();
      expect(screen.getByText("2024-06-10")).toBeInTheDocument();

      const chips = screen.getAllByTestId("skill-chip");
      expect(chips.map((c) => c.textContent)).toEqual(["web-search", "arxiv"]);

      const link = screen.getByRole("link", { name: /scout-01/i });
      expect(link).toHaveAttribute("href", "/agents/scout-01");
    });
  });
  ```

- [ ] **Step 9: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/components/AgentCard.test.tsx
  ```
  Expected: `Cannot find module './AgentCard'`.

- [ ] **Step 10: Implement `apps/web/src/components/AgentCard.tsx`.**
  ```tsx
  import Link from "next/link";
  import type { AgentSummary } from "@aeonomy/shared";
  import { AvatarBlob } from "./AvatarBlob";
  import { SkillChip } from "./SkillChip";
  import { shortAddress, formatCreatedAt } from "./format";

  export function AgentCard({ agent }: { agent: AgentSummary }) {
    return (
      <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <AvatarBlob seed={agent.handle} />
          <Link
            href={`/agents/${agent.handle}`}
            className="text-lg font-medium text-ink hover:underline"
          >
            {agent.handle}
          </Link>
        </div>
        <div className="flex flex-wrap gap-1">
          {agent.skills.map((slug) => (
            <SkillChip key={slug} slug={slug} />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{shortAddress(agent.wallet)}</span>
          <time dateTime={String(agent.createdAt)}>
            {formatCreatedAt(agent.createdAt)}
          </time>
        </div>
      </article>
    );
  }
  ```

- [ ] **Step 11: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/components/AgentCard.test.tsx
  ```
  Expected: `Tests  1 passed (1)`.

- [ ] **Step 12: Commit.**
  ```bash
  git add apps/web/src/components apps/web/src/test/fixtures.ts && git commit -m "feat(web): AgentCard + SkillChip + AvatarBlob + formatters"
  ```

---

### Task 31: `/create` wizard page wiring

**Files:**
- Create `apps/web/app/create/page.tsx`
- Create `apps/web/src/features/create/CreateWizard.tsx`
- Create `apps/web/src/features/create/useHandleAvailability.ts`
- Create `apps/web/app/create/page.test.tsx` (Test)

> The pure logic (reducers, validators, builders, hooks) is already tested in Tasks 24–27. This task wires them into a client component. The page test is a light render smoke test of the initial (connect) step — heavy e2e is explicitly out of scope.

- [ ] **Step 1: Implement `apps/web/src/features/create/useHandleAvailability.ts`.** Debounced availability checker that drives the reducer from Task 28 and calls `GET /api/agents/handle-available`.
  ```ts
  "use client";

  import { useEffect, useReducer } from "react";
  import {
    availabilityReducer,
    initialAvailabilityState,
    validateHandleFormat,
  } from "./handleAvailability";
  import { fetchHandleAvailable } from "../../lib/api";

  export function useHandleAvailability(handle: string, debounceMs = 350) {
    const [state, dispatch] = useReducer(
      availabilityReducer,
      initialAvailabilityState,
    );

    useEffect(() => {
      dispatch({ type: "input", handle });
      const fmt = validateHandleFormat(handle);
      if (!fmt.ok || handle.length === 0) return;

      let cancelled = false;
      const t = setTimeout(async () => {
        try {
          const res = await fetchHandleAvailable(handle);
          if (cancelled) return;
          dispatch({
            type: "result",
            handle,
            available: res.available,
            reason: res.reason,
          });
        } catch {
          if (!cancelled) dispatch({ type: "fail", handle });
        }
      }, debounceMs);

      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [handle, debounceMs]);

    return state;
  }
  ```

- [ ] **Step 2: Implement `apps/web/src/features/create/CreateWizard.tsx`.** Full wizard client component composing every piece. (Minimal styling; visual pass is Task 33.)
  ```tsx
  "use client";

  import { useEffect, useReducer, useState } from "react";
  import { useRouter } from "next/navigation";
  import { useAccount } from "wagmi";
  import { ConnectButton } from "@rainbow-me/rainbowkit";
  import type { Address } from "viem";
  import {
    wizardReducer,
    initialWizardState,
    canAdvance,
  } from "./wizardMachine";
  import { useHandleAvailability } from "./useHandleAvailability";
  import { usePredictedWallet } from "../../hooks/usePredictedWallet";
  import { useSpawnAgent } from "../../hooks/useSpawnAgent";
  import { fetchSkills } from "../../lib/api";
  import { buildManifest, buildConfig } from "../../lib/manifest";
  import { pinManifest } from "../../lib/api";
  import { computeConfigHash, type Skill } from "@aeonomy/shared";
  import { SkillChip } from "../../components/SkillChip";
  import { shortAddress } from "../../components/format";

  export function CreateWizard() {
    const router = useRouter();
    const { address, isConnected } = useAccount();
    const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const availability = useHandleAvailability(state.handle);
    const predicted = usePredictedWallet(state.owner, state.handle);
    const { spawn, isWriting, isConfirming, isConfirmed, spawned, error } =
      useSpawnAgent();

    // sync wallet connection into machine
    useEffect(() => {
      dispatch({
        type: "setConnected",
        connected: isConnected,
        owner: address as Address | undefined,
      });
    }, [isConnected, address]);

    // sync availability into machine
    useEffect(() => {
      dispatch({
        type: "setHandleAvailable",
        available: availability.status === "available",
      });
    }, [availability.status]);

    // load skills when entering skills step
    useEffect(() => {
      if (state.step === "skills" && skills.length === 0) {
        fetchSkills().then(setSkills).catch(() => setSkills([]));
      }
    }, [state.step, skills.length]);

    // redirect after the agent is indexed-or-confirmed
    useEffect(() => {
      if (isConfirmed && spawned) {
        router.push(`/agents/${state.handle}`);
      }
    }, [isConfirmed, spawned, router, state.handle]);

    async function handleSubmit() {
      if (!state.owner) return;
      setSubmitError(null);
      setSubmitting(true);
      try {
        const manifest = buildManifest({
          handle: state.handle,
          owner: state.owner,
          skills: state.skills,
          persona: state.persona,
          createdAt: Math.floor(Date.now() / 1000),
        });
        const { manifestHash } = await pinManifest(manifest);
        const config = buildConfig({
          handle: state.handle,
          skills: state.skills,
          persona: state.persona,
        });
        const configHash = computeConfigHash(config);
        await spawn({ handle: state.handle, manifestHash, configHash });
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Submission failed.");
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <ol className="mb-8 flex gap-2 text-xs text-muted" aria-label="steps">
          {["connect", "handle", "skills", "persona", "review"].map((s) => (
            <li
              key={s}
              aria-current={state.step === s ? "step" : undefined}
              className={
                state.step === s ? "font-semibold text-ink" : undefined
              }
            >
              {s}
            </li>
          ))}
        </ol>

        {state.step === "connect" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Connect your wallet</h2>
            <ConnectButton />
          </section>
        )}

        {state.step === "handle" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Choose a handle</h2>
            <input
              aria-label="handle"
              className="w-full rounded border border-line px-3 py-2"
              value={state.handle}
              onChange={(e) =>
                dispatch({ type: "setHandle", handle: e.target.value })
              }
              placeholder="lowercase-handle"
            />
            <p className="mt-2 text-sm" role="status">
              {availability.status === "checking" && "Checking…"}
              {availability.status === "available" && "Available"}
              {availability.status === "taken" &&
                (availability.reason ?? "Taken")}
              {availability.status === "invalid" && availability.reason}
              {availability.status === "error" && availability.reason}
            </p>
            {predicted.data && (
              <p className="mt-1 text-xs text-muted">
                Predicted wallet: {shortAddress(predicted.data)}
              </p>
            )}
          </section>
        )}

        {state.step === "skills" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Pick skills</h2>
            <ul className="grid grid-cols-2 gap-2">
              {skills.map((sk) => {
                const selected = state.skills.includes(sk.slug);
                return (
                  <li key={sk.slug}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        dispatch({ type: "toggleSkill", slug: sk.slug })
                      }
                      className={`w-full rounded border px-3 py-2 text-left ${
                        selected ? "border-accent" : "border-line"
                      }`}
                    >
                      <span className="font-medium">{sk.name}</span>
                      <span className="block text-xs text-muted">
                        {sk.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {state.step === "persona" && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Persona</h2>
            <input
              aria-label="display name"
              className="rounded border border-line px-3 py-2"
              value={state.persona.displayName}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, displayName: e.target.value },
                })
              }
              placeholder="Display name"
            />
            <textarea
              aria-label="bio"
              className="rounded border border-line px-3 py-2"
              value={state.persona.bio}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, bio: e.target.value },
                })
              }
              placeholder="Short bio"
            />
            <input
              aria-label="avatar seed"
              className="rounded border border-line px-3 py-2"
              value={state.persona.avatarSeed}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, avatarSeed: e.target.value },
                })
              }
              placeholder="Avatar seed"
            />
          </section>
        )}

        {state.step === "review" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Review &amp; spawn</h2>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="inline font-medium">Handle: </dt>
                <dd className="inline">{state.handle}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Skills: </dt>
                <dd className="inline">
                  {state.skills.map((s) => (
                    <SkillChip key={s} slug={s} />
                  ))}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Display name: </dt>
                <dd className="inline">{state.persona.displayName}</dd>
              </div>
              {predicted.data && (
                <div>
                  <dt className="inline font-medium">Predicted wallet: </dt>
                  <dd className="inline">{shortAddress(predicted.data)}</dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              className="mt-4 rounded bg-accent px-4 py-2 text-surface disabled:opacity-50"
              disabled={submitting || isWriting || isConfirming}
              onClick={handleSubmit}
            >
              {isWriting
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Waiting for confirmation…"
                  : "Spawn agent"}
            </button>
            {(submitError || error) && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {submitError ?? (error as Error)?.message}
              </p>
            )}
          </section>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            className="rounded border border-line px-4 py-2 disabled:opacity-40"
            onClick={() => dispatch({ type: "back" })}
            disabled={state.step === "connect"}
          >
            Back
          </button>
          {state.step !== "review" && (
            <button
              type="button"
              className="rounded border border-line px-4 py-2 disabled:opacity-40"
              onClick={() => dispatch({ type: "next" })}
              disabled={!canAdvance(state)}
            >
              Next
            </button>
          )}
        </div>
      </main>
    );
  }
  ```

- [ ] **Step 3: Implement `apps/web/app/create/page.tsx`.**
  ```tsx
  import { CreateWizard } from "../../src/features/create/CreateWizard";

  export default function CreatePage() {
    return <CreateWizard />;
  }
  ```

- [ ] **Step 4: Write the render smoke test `apps/web/app/create/page.test.tsx`.** Mocks wagmi/RainbowKit/next-navigation so the component mounts in jsdom; asserts the connect step renders. (Functional smoke only — no full flow.)
  ```tsx
  import { describe, it, expect, vi } from "vitest";
  import { render, screen } from "@testing-library/react";

  vi.mock("wagmi", () => ({
    useAccount: () => ({ address: undefined, isConnected: false }),
    usePublicClient: () => undefined,
    useWriteContract: () => ({
      writeContractAsync: vi.fn(),
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      data: undefined,
      isLoading: false,
      isSuccess: false,
      error: null,
    }),
  }));
  vi.mock("@rainbow-me/rainbowkit", () => ({
    ConnectButton: () => <button>Connect Wallet</button>,
  }));
  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
  }));
  vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: undefined, isLoading: false }),
  }));

  import CreatePage from "./page";

  describe("CreatePage", () => {
    it("renders the connect step first", () => {
      render(<CreatePage />);
      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 5: Run the page test — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test app/create/page.test.tsx
  ```
  Expected: `Tests  1 passed (1)`.

- [ ] **Step 6: Typecheck the whole app.**
  ```bash
  pnpm --filter @aeonomy/web typecheck
  ```
  Expected: exit 0.

- [ ] **Step 7: Commit.**
  ```bash
  git add apps/web/app/create apps/web/src/features/create/CreateWizard.tsx apps/web/src/features/create/useHandleAvailability.ts && git commit -m "feat(web): /create wizard page wiring"
  ```

---

### Task 32: `/agents` gallery + `/agents/[handle]` profile pages

**Files:**
- Create `apps/web/src/features/gallery/AgentGallery.tsx`
- Create `apps/web/src/features/gallery/filterAgents.ts`
- Create `apps/web/src/features/gallery/filterAgents.test.ts` (Test)
- Create `apps/web/app/agents/page.tsx`
- Create `apps/web/app/agents/[handle]/page.tsx`
- Create `apps/web/app/agents/[handle]/AgentProfile.tsx`
- Create `apps/web/app/agents/[handle]/AgentProfile.test.tsx` (Test)

> The list/detail data comes from the read API. The gallery filters/sorts client-side over the already-fetched page; the pure filter function is unit-tested.

- [ ] **Step 1: Write the failing test `apps/web/src/features/gallery/filterAgents.test.ts`.**
  ```ts
  import { describe, it, expect } from "vitest";
  import { filterAndSortAgents } from "./filterAgents";
  import type { AgentSummary } from "@aeonomy/shared";

  const a: AgentSummary = {
    agentId: 1,
    handle: "alpha",
    owner: "0xaa",
    wallet: "0xbb",
    skills: ["web-search"],
    createdAt: 100,
  };
  const b: AgentSummary = {
    agentId: 2,
    handle: "beta",
    owner: "0xaa",
    wallet: "0xcc",
    skills: ["arxiv"],
    createdAt: 300,
  };
  const c: AgentSummary = {
    agentId: 3,
    handle: "gamma",
    owner: "0xaa",
    wallet: "0xdd",
    skills: ["web-search", "arxiv"],
    createdAt: 200,
  };

  describe("filterAndSortAgents", () => {
    it("filters by skill", () => {
      const out = filterAndSortAgents([a, b, c], { skill: "arxiv" });
      expect(out.map((x) => x.handle)).toEqual(["beta", "gamma"]);
    });

    it("sorts by recent (createdAt desc) by default", () => {
      const out = filterAndSortAgents([a, b, c], {});
      expect(out.map((x) => x.handle)).toEqual(["beta", "gamma", "alpha"]);
    });

    it("returns all when no skill filter", () => {
      const out = filterAndSortAgents([a, b, c], { skill: "" });
      expect(out).toHaveLength(3);
    });
  });
  ```

- [ ] **Step 2: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/gallery/filterAgents.test.ts
  ```
  Expected: `Cannot find module './filterAgents'`.

- [ ] **Step 3: Implement `apps/web/src/features/gallery/filterAgents.ts`.**
  ```ts
  import type { AgentSummary } from "@aeonomy/shared";

  export interface GalleryFilter {
    skill?: string;
    sort?: "recent";
  }

  export function filterAndSortAgents(
    agents: AgentSummary[],
    filter: GalleryFilter,
  ): AgentSummary[] {
    let out = agents;
    if (filter.skill) {
      out = out.filter((a) => a.skills.includes(filter.skill as string));
    }
    // default + "recent" both mean createdAt desc
    return [...out].sort((x, y) => y.createdAt - x.createdAt);
  }
  ```

- [ ] **Step 4: Run it — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test src/features/gallery/filterAgents.test.ts
  ```
  Expected: `Tests  3 passed (3)`.

- [ ] **Step 5: Implement `apps/web/src/features/gallery/AgentGallery.tsx`.** Client component: fetch agents + skills, expose a skill filter dropdown and recent sort, render `AgentCard`s.
  ```tsx
  "use client";

  import { useEffect, useMemo, useState } from "react";
  import type { AgentSummary, Skill } from "@aeonomy/shared";
  import { fetchAgents, fetchSkills } from "../../lib/api";
  import { AgentCard } from "../../components/AgentCard";
  import { filterAndSortAgents } from "./filterAgents";

  export function AgentGallery() {
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [skill, setSkill] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      Promise.all([fetchAgents({ sort: "recent", limit: 60 }), fetchSkills()])
        .then(([agentsRes, skillsRes]) => {
          if (cancelled) return;
          setAgents(agentsRes.agents);
          setSkills(skillsRes);
        })
        .catch(() => {
          if (!cancelled) setAgents([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []);

    const visible = useMemo(
      () => filterAndSortAgents(agents, { skill, sort: "recent" }),
      [agents, skill],
    );

    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Agents</h1>
          <label className="text-sm">
            Skill:{" "}
            <select
              aria-label="filter by skill"
              className="rounded border border-line px-2 py-1"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              <option value="">All</option>
              {skills.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-muted">No agents yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <AgentCard key={a.agentId} agent={a} />
            ))}
          </div>
        )}
      </main>
    );
  }
  ```

- [ ] **Step 6: Implement `apps/web/app/agents/page.tsx`.**
  ```tsx
  import { AgentGallery } from "../../src/features/gallery/AgentGallery";

  export default function AgentsPage() {
    return <AgentGallery />;
  }
  ```

- [ ] **Step 7: Write the failing test `apps/web/app/agents/[handle]/AgentProfile.test.tsx`.**
  ```tsx
  import { describe, it, expect } from "vitest";
  import { render, screen } from "@testing-library/react";
  import { AgentProfile } from "./AgentProfile";
  import { AGENT_DETAIL_FIXTURE } from "../../../src/test/fixtures";

  describe("AgentProfile", () => {
    it("renders identity, basescan link, persona, skills, and placeholders", () => {
      render(
        <AgentProfile agent={AGENT_DETAIL_FIXTURE} ipfsGateway="gateway.pinata.cloud" />,
      );

      expect(screen.getByText("scout-01")).toBeInTheDocument();
      expect(screen.getByText("Scout")).toBeInTheDocument();
      expect(
        screen.getByText(/finds things on the web/i),
      ).toBeInTheDocument();

      const basescan = screen.getByRole("link", { name: /view on basescan/i });
      expect(basescan).toHaveAttribute(
        "href",
        "https://sepolia.basescan.org/address/0x00000000000000000000000000000000000000bb",
      );

      const cidLink = screen.getByRole("link", { name: /manifest/i });
      expect(cidLink).toHaveAttribute(
        "href",
        "https://gateway.pinata.cloud/ipfs/QmFakeCidForTestsXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      );

      expect(screen.getByText(/memory/i)).toBeInTheDocument();
      expect(screen.getByText(/earnings/i)).toBeInTheDocument();
      expect(screen.getByText(/coming in a later slice/i)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 8: Run it — expect FAIL.**
  ```bash
  pnpm --filter @aeonomy/web test "app/agents/[handle]/AgentProfile.test.tsx"
  ```
  Expected: `Cannot find module './AgentProfile'`.

- [ ] **Step 9: Implement `apps/web/app/agents/[handle]/AgentProfile.tsx`.** Pure presentational component (takes the already-fetched `AgentDetail` + gateway) so it is unit-testable without network.
  ```tsx
  import type { AgentDetail } from "@aeonomy/shared";
  import { AvatarBlob } from "../../../src/components/AvatarBlob";
  import { SkillChip } from "../../../src/components/SkillChip";
  import {
    shortAddress,
    formatCreatedAt,
    basescanAddressUrl,
    ipfsUrl,
  } from "../../../src/components/format";

  export function AgentProfile({
    agent,
    ipfsGateway,
  }: {
    agent: AgentDetail;
    ipfsGateway: string;
  }) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <header className="flex items-center gap-4">
          <AvatarBlob seed={agent.persona.avatarSeed || agent.handle} size={64} />
          <div>
            <h1 className="text-2xl font-semibold">{agent.handle}</h1>
            <p className="text-muted">{agent.persona.displayName}</p>
          </div>
        </header>

        <section className="mt-6 space-y-1 text-sm">
          <p>
            <span className="font-medium">Owner: </span>
            {shortAddress(agent.owner)}
          </p>
          <p>
            <span className="font-medium">Wallet: </span>
            {shortAddress(agent.wallet)}{" "}
            <a
              className="underline"
              href={basescanAddressUrl(agent.wallet)}
              target="_blank"
              rel="noreferrer"
            >
              view on basescan
            </a>
          </p>
          <p>
            <span className="font-medium">Created: </span>
            {formatCreatedAt(agent.createdAt)}
          </p>
          <p>
            <a
              className="underline"
              href={ipfsUrl(ipfsGateway, agent.manifestCid)}
              target="_blank"
              rel="noreferrer"
            >
              manifest (IPFS)
            </a>
          </p>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-medium">Skills</h2>
          <div className="flex flex-wrap gap-1">
            {agent.skills.map((s) => (
              <SkillChip key={s} slug={s} />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-lg font-medium">Persona</h2>
          <p className="text-sm text-muted">{agent.persona.bio}</p>
        </section>

        <section className="mt-6 rounded border border-dashed border-line p-4 text-sm text-muted">
          <h2 className="font-medium">Memory</h2>
          <p>Coming in a later slice.</p>
        </section>

        <section className="mt-4 rounded border border-dashed border-line p-4 text-sm text-muted">
          <h2 className="font-medium">Earnings</h2>
          <p>Coming in a later slice.</p>
        </section>
      </main>
    );
  }
  ```

- [ ] **Step 10: Run the profile test — expect PASS.**
  ```bash
  pnpm --filter @aeonomy/web test "app/agents/[handle]/AgentProfile.test.tsx"
  ```
  Expected: `Tests  1 passed (1)`.

- [ ] **Step 11: Implement `apps/web/app/agents/[handle]/page.tsx`.** Server component: fetch the detail from the read API (absolute URL so it works server-side), 404 via `notFound()`.
  ```tsx
  import { notFound } from "next/navigation";
  import type { AgentDetail } from "@aeonomy/shared";
  import { AgentProfile } from "./AgentProfile";

  async function getAgent(handle: string): Promise<AgentDetail | null> {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const res = await fetch(
      `${base}/api/agents/${encodeURIComponent(handle)}`,
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`agent fetch -> ${res.status}`);
    const data = (await res.json()) as { agent: AgentDetail };
    return data.agent;
  }

  export default async function AgentProfilePage({
    params,
  }: {
    params: Promise<{ handle: string }>;
  }) {
    const { handle } = await params;
    const agent = await getAgent(handle);
    if (!agent) notFound();
    const ipfsGateway = process.env.IPFS_GATEWAY ?? "gateway.pinata.cloud";
    return <AgentProfile agent={agent} ipfsGateway={ipfsGateway} />;
  }
  ```

- [ ] **Step 12: Typecheck.**
  ```bash
  pnpm --filter @aeonomy/web typecheck
  ```
  Expected: exit 0.

- [ ] **Step 13: Run the full web test suite.**
  ```bash
  pnpm --filter @aeonomy/web test
  ```
  Expected: all test files pass.

- [ ] **Step 14: Commit.**
  ```bash
  git add apps/web/app/agents apps/web/src/features/gallery && git commit -m "feat(web): /agents gallery + /agents/[handle] profile"
  ```

---

### Task 33: Visual design pass (frontend-design skill hook) — NO generic theme

> **This task intentionally contains NO hardcoded styling.** All prior tasks shipped functional, minimally-styled components and routed every color/spacing decision through the `--color-*` CSS variables in `apps/web/app/globals.css`. This task hands those components to the `frontend-design` skill to produce the distinctive, anti-generic visual language. **Do NOT** introduce shadcn default dark mode, a purple gradient, or a generic dashboard layout.

**Files:**
- Modify `apps/web/app/globals.css` (design tokens, type scale, spacing — authored by the skill)
- Modify `apps/web/src/components/AgentCard.tsx` (visual refinement only — keep props + `data-testid`s + `/agents/[handle]` link intact)
- Modify `apps/web/src/components/AvatarBlob.tsx` (refined generative avatar — keep `data-testid="avatar-blob"` + `seed` prop)
- Modify `apps/web/src/components/SkillChip.tsx` (keep `data-testid="skill-chip"` + text content = slug)
- Modify `apps/web/src/features/create/CreateWizard.tsx` (visual only — keep all `aria-label`s, `role="status"`/`role="alert"`, step labels)
- Modify `apps/web/app/agents/[handle]/AgentProfile.tsx` (visual only — keep link names "view on basescan" / "manifest", placeholder text "Coming in a later slice.")
- Modify `apps/web/src/features/gallery/AgentGallery.tsx` (visual only — keep `aria-label="filter by skill"`)

- [ ] **Step 1: Invoke the `frontend-design` skill** with the design brief: codename Aeonomy; a distinctive on-chain-agent identity aesthetic; surfaces = landing, `/create` wizard, `/agents` gallery cards, `/agents/[handle]` profile. Hard constraints from the spec §10: **anti-generic crypto — NO default shadcn dark mode, NO purple gradient, NO generic dashboard look.** Theme via the existing `--color-surface/--color-ink/--color-muted/--color-accent/--color-line` tokens plus any new tokens the skill adds to `globals.css`.

- [ ] **Step 2: Apply the skill's output** by editing ONLY the className/markup/token layers of the files above. Preserve every test-load-bearing contract verbatim:
  - `data-testid` values: `avatar-blob`, `skill-chip`.
  - `SkillChip` text content === the skill slug.
  - `AgentCard`: renders handle text, `shortAddress(wallet)`, `formatCreatedAt(createdAt)`, one `skill-chip` per skill, and a link to `/agents/<handle>`.
  - `AgentProfile`: a link named "view on basescan" pointing at `basescanAddressUrl(wallet)`, a link named "manifest" pointing at the IPFS gateway URL, and the literal placeholder text `Coming in a later slice.` under "Memory" and "Earnings".
  - `CreateWizard`: `aria-label`s `handle`/`display name`/`bio`/`avatar seed`, `role="status"` availability line, the step labels `connect/handle/skills/persona/review`.
  - `AgentGallery`: `aria-label="filter by skill"`.

- [ ] **Step 3: Re-run the entire web test suite to prove the visual pass did not break behavior.**
  ```bash
  pnpm --filter @aeonomy/web test
  ```
  Expected: all test files pass (same green as Task 32, Step 13).

- [ ] **Step 4: Typecheck + production build to catch styling/SSR regressions.**
  ```bash
  pnpm --filter @aeonomy/web typecheck && pnpm --filter @aeonomy/web build
  ```
  Expected: typecheck exit 0; `next build` completes with all routes (`/`, `/create`, `/agents`, `/agents/[handle]`) compiled.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/web && git commit -m "feat(web): distinctive visual design via frontend-design skill (anti-generic)"
  ```
