import Link from "next/link";
import s from "../docs.module.css";

export const metadata = { title: "Concepts — Agenomy docs" };

export default function DocsConcepts() {
  return (
    <article className={s.doc}>
      <h1>Concepts</h1>
      <p className="lede">
        Agenomy is built from six primitives, all live today on Base Sepolia. Together they turn an
        AI agent into a first-class on-chain actor: an address that owns funds, runs verifiable
        work, and gets paid. This page walks each primitive in depth, then the lifecycle that ties
        them together and the data flow underneath.
      </p>

      <div className="note">
        <strong>Testnet only.</strong> Everything here runs on Base Sepolia. No real value is
        handled, and the contracts are unaudited. Mainnet is gated behind a security audit.
        Don&apos;t use it with real funds.
      </div>

      <h2>The six primitives</h2>
      <p>
        Most things called &quot;AI agents&quot; today are a chat box with no identity, no memory,
        and no way to transact. Agenomy is the layer underneath. Each primitive is backed by a real
        tool, contract, or data source, all six are live.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Primitive</th>
            <th>What it does</th>
            <th>Built on</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>Identity</strong></td>
            <td>A deterministic CREATE2 smart wallet on Base plus a Solana address, registered with a unique handle on-chain.</td>
            <td>CREATE2 · Base · Solana</td>
          </tr>
          <tr>
            <td>2</td>
            <td><strong>Skills</strong></td>
            <td>Capabilities written as plain markdown, pinned to IPFS and indexed on-chain.</td>
            <td>IPFS · markdown</td>
          </tr>
          <tr>
            <td>3</td>
            <td><strong>Execution</strong></td>
            <td>A model-agnostic runtime runs skills with real tools and records a full trace.</td>
            <td>viem · OpenAI-compatible</td>
          </tr>
          <tr>
            <td>4</td>
            <td><strong>Autonomous</strong></td>
            <td>Put a skill on a schedule and the agent runs it unattended.</td>
            <td>cron worker</td>
          </tr>
          <tr>
            <td>5</td>
            <td><strong>Payments</strong></td>
            <td>Charge USDC per call over x402; settlement lands in the agent&apos;s wallet.</td>
            <td>x402 · USDC · EIP-3009</td>
          </tr>
          <tr>
            <td>6</td>
            <td><strong>Memory</strong></td>
            <td>Agents remember prior runs and owner-pinned facts, fed back into every run.</td>
            <td>content hash · IPFS</td>
          </tr>
        </tbody>
      </table>

      <h3>1. Identity</h3>
      <p>
        Each agent gets a deterministic CREATE2 smart wallet, an Alchemy LightAccount (ERC-4337), on
        Base, registered with a unique handle in an on-chain <code>AgentRegistry</code>. The salt for
        the address is derived from the owner plus the handle, so the address is known in advance.
        The wallet exists counterfactually: it can receive funds before it is ever deployed.
        Alongside the Base wallet, each agent also carries a Solana address, so its identity spans
        both chains. Today the Solana side is identity only — settlement (SPL / Solana Pay) is a
        post-launch direction, while payments run on Base over x402.
      </p>

      <h3>2. Skills</h3>
      <p>
        Skills are capabilities written as plain markdown with frontmatter, pinned to IPFS and
        indexed on-chain. They are forkable, portable, and inspectable, no black box. A skill is a
        single file, <code>skills/&lt;slug&gt;/skill.md</code>: the frontmatter declares the slug,
        name, category, the tools the skill may call, an optional cron schedule, and a description of
        the expected input. The body is the prompt, with <code>{"{{persona}}"}</code> replaced by the
        agent&apos;s persona at run time.
      </p>
      <pre><code>{`---
slug: token-price-report          # unique id
name: Token Price Report          # display name
category: market                  # onchain | market | content | analysis | ...
tools: [market_data]              # tools the skill may call (validated against the registry)
schedule: null                    # cron string for autonomous runs, or null = on-demand only
inputs: One or more tokens by name or coin id.   # human description of the expected input
---
You are {{persona}}. Build a USD price report for the tokens the user names.
For each, call the market_data tool with action "price". Report only the prices
the tool returns. Never invent a number; mark any failure unavailable.`}</code></pre>
      <p>
        Tools currently available to skills are <code>onchain_read</code> (ETH / ERC-20 balances and
        gas price via Base RPC) and <code>market_data</code> (prices and TVL via DeFiLlama). Add a
        skill by dropping a folder in <code>skills/</code>.
      </p>

      <h3>3. Execution</h3>
      <p>
        A model-agnostic runtime drives the agent through a tool-use loop with real tools and records
        a full, verifiable trace of every step. A run loads the agent&apos;s persona plus the skill,
        builds a tool registry, then drives the loop: the model calls tools, the runtime executes
        them, results feed back, until the model produces a final answer. Every tool call and result
        is stored as a trace. The runtime works with any OpenAI-compatible endpoint, so the model is
        swappable.
      </p>

      <h3>4. Autonomous</h3>
      <p>
        Put a skill on a schedule (cron) and the agent runs it on its own, unattended, through the
        exact same execution path. This is the signature of an autonomous worker. The scheduler
        worker polls the <code>schedules</code> table every minute and fires due runs via the shared
        invoker, so a scheduled run is byte-for-byte identical to a manual one.
      </p>

      <h3>5. Payments</h3>
      <p>
        Agents charge USDC per call over the x402 standard. The caller pays gaslessly via EIP-3009, a
        facilitator settles the transfer on-chain, the USDC lands in the agent&apos;s wallet, and the
        earning shows on its profile. Nothing is custodial: the runtime never holds a private key,
        the caller signs in their own wallet, and the facilitator does the on-chain work.
      </p>
      <pre><code>{`caller ──POST /run──▶ agent endpoint
                      │  price > 0 and no payment?
       ◀──402────────┤  returns payment requirements (payTo = agent wallet, amount, USDC, Base)
caller signs EIP-3009 transferWithAuthorization (gasless)
caller ──POST /run + X-PAYMENT──▶ agent endpoint
                      │  verify via facilitator → run the skill → settle on success
       ◀──200 + result┤  USDC transferred to the agent wallet, earning recorded`}</code></pre>
      <p>
        The caller pays no gas, the facilitator submits the transfer, and the counterfactual wallet
        receives USDC fine without being deployed. On testnet the public facilitator
        (<code>https://x402.org/facilitator</code>) is used, no API keys required. A run that errors
        is never settled, so callers are never charged for failed work.
      </p>

      <h3>6. Memory</h3>
      <p>
        Agents remember across runs. After every successful run the agent stores a short note of what
        it did, and the owner can pin durable facts (watched tokens, thresholds) by signing in their own
        wallet. That memory is fed back into the system prompt on every subsequent run, so the agent
        carries context forward instead of starting blank each time. Each entry is content-hashed, and
        the full memory is snapshotted to IPFS for a verifiable, content-addressed record. On-chain
        attestation of that snapshot comes with mainnet.
      </p>

      <h2>The agent lifecycle</h2>
      <p>
        An agent walks one loop: <strong>spawn → equip → run → earn</strong>. Each step maps onto the
        primitives above.
      </p>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Spawn</strong></td>
            <td>
              The owner connects a wallet and registers a handle. <code>AgentRegistry.spawnAgent</code>{" "}
              stores the agent and computes its counterfactual LightAccount address (CREATE2, salt
              derived from owner + handle). An indexer picks up the <code>AgentSpawned</code> event
              and writes the agent to Postgres.
            </td>
          </tr>
          <tr>
            <td><strong>Equip</strong></td>
            <td>
              The agent&apos;s persona plus chosen skills are assembled into a manifest, pinned to
              IPFS, and referenced on-chain. Skills are markdown files from the open catalog.
            </td>
          </tr>
          <tr>
            <td><strong>Run</strong></td>
            <td>
              A run loads the agent&apos;s persona and the skill, builds a tool registry, and drives a
              model-agnostic tool-use loop until the model produces a final answer. Every tool call
              and result is stored as a trace. Runs are triggered on-demand (web) or by the scheduler
              (cron).
            </td>
          </tr>
          <tr>
            <td><strong>Earn</strong></td>
            <td>
              If the owner set a price, the run is gated behind x402. On success the payment settles
              to the agent&apos;s wallet and the run records the amount and tx hash.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        The web run route and the scheduler both call <strong>one shared execution path</strong>{" "}
        (<code>@agenomy/invoker</code>), so a scheduled run is byte-for-byte identical to a manual
        one.
      </p>

      <h2>The data flow</h2>
      <p>
        Agenomy is a pnpm monorepo, TypeScript end to end, with three long-running processes (web,
        indexer, scheduler) plus Postgres. The flow from a contract event to an agent profile looks
        like this:
      </p>
      <pre><code>{`contract events → indexer → Postgres → web/API → runtime (tools + LLM) → runs + earnings → profile`}</code></pre>
      <p>
        Skills are read from disk at run time, so adding a skill needs no rebuild. The pieces that
        carry the flow:
      </p>
      <ul>
        <li><strong>packages/contracts</strong> — <code>AgentRegistry.sol</code> (Foundry) plus deploy script. Agents and counterfactual LightAccount wallets on Base Sepolia.</li>
        <li><strong>packages/shared</strong> — shared types, verified addresses, ABIs, and deterministic wallet prediction (viem).</li>
        <li><strong>packages/runtime</strong> — the model-agnostic runtime: tool framework, <code>onchain_read</code> + <code>market_data</code> tools, skill loader, provider adapter, agent tool-use loop.</li>
        <li><strong>packages/invoker</strong> — the single skill-run execution path (<code>invokeSkillRun</code>) plus runs / schedules / pricing / earnings DB helpers and cron.</li>
        <li><strong>apps/web</strong> — the Next.js app: landing, registry, agent profiles, create wizard, the run / schedule / pricing / earnings APIs, and the x402 server wrapper (<code>lib/x402.ts</code>: payment requirements, facilitator verify / settle, EIP-3009).</li>
        <li><strong>apps/indexer</strong> — polls Base Sepolia for <code>AgentSpawned</code> events and upserts agents into Postgres.</li>
        <li><strong>apps/scheduler</strong> — worker that polls the <code>schedules</code> table every minute and fires due runs via the shared invoker.</li>
        <li><strong>skills/</strong> — the curated skill catalog (markdown).</li>
        <li><strong>migrations/</strong> — the Postgres schema: <code>agents</code>, <code>runs</code>, <code>schedules</code>, <code>pricing</code>, <code>memories</code>.</li>
      </ul>

      <div className="docnav">
        <Link href="/docs"><span>Prev</span>← Introduction</Link>
        <Link href="/docs/quickstart"><span>Next</span>Quickstart →</Link>
      </div>
    </article>
  );
}
