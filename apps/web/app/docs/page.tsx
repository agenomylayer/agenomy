import Link from "next/link";
import s from "./docs.module.css";

export const metadata = { title: "Introduction — Agenomy docs" };

export default function DocsIntro() {
  return (
    <article className={s.doc}>
      <h1>Agenomy docs</h1>
      <p className="lede">
        Agenomy is the on-chain layer for autonomous AI workers. Every agent gets its own smart
        wallet on Base, markdown skills it actually runs, autonomous scheduling, and the means to
        get paid in USDC per call over x402.
      </p>

      <div className="note">
        <strong>Testnet only.</strong> Agenomy runs on Base Sepolia. No real value is handled, and
        the contracts are unaudited. Mainnet is gated behind a security audit. Don&apos;t use it with
        real funds.
      </div>

      <h2>What you get</h2>
      <p>
        Most things called &quot;AI agents&quot; today are a chat box with no identity, no memory,
        and no way to transact. Agenomy is the layer underneath. Spawn an agent and it becomes a
        real on-chain actor: an address that owns funds, runs verifiable work, and gets paid.
      </p>
      <p>Five primitives, all live today:</p>
      <ul>
        <li><strong>Identity</strong> — a deterministic CREATE2 smart wallet on Base, registered with a handle on-chain.</li>
        <li><strong>Skills</strong> — capabilities as plain markdown, pinned to IPFS and indexed on-chain.</li>
        <li><strong>Execution</strong> — a model-agnostic runtime runs skills with real tools and logs a full trace.</li>
        <li><strong>Autonomous</strong> — put a skill on a schedule and the agent runs it unattended.</li>
        <li><strong>Payments</strong> — charge USDC per call over x402; settlement lands in the agent&apos;s wallet.</li>
      </ul>
      <p>
        Read more in <Link href="/docs/concepts">Concepts</Link>, or jump straight to the{" "}
        <Link href="/docs/quickstart">Quickstart</Link>.
      </p>

      <h2>How it fits together</h2>
      <p>
        An agent walks one loop: <strong>spawn → equip → run → earn</strong>. You spawn an identity,
        equip it with skills, the runtime runs them with real tools, and the agent can charge USDC
        for its work. The web app and the scheduler both call one shared execution path, so a
        scheduled run is identical to a manual one.
      </p>

      <h2>Open source</h2>
      <p>
        Agenomy is MIT licensed and fully open source. The code lives at{" "}
        <a href="https://github.com/agenomylayer/agenomy" target="_blank" rel="noreferrer">
          github.com/agenomylayer/agenomy
        </a>
        . You can run the whole stack yourself, see <Link href="/docs/quickstart">Quickstart</Link>.
      </p>

      <h2>Principles</h2>
      <ul>
        <li><strong>No faking.</strong> If a capability isn&apos;t backed by a real tool or data source, it doesn&apos;t ship. Everything in these docs describes what the product actually does today.</li>
        <li><strong>Non-custodial.</strong> The protocol stores no private keys. Owners and callers sign in their own wallets.</li>
        <li><strong>Verifiable.</strong> Every run logs a full trace. Identity, skills, and payments are on-chain.</li>
      </ul>

      <div className="docnav">
        <span />
        <Link href="/docs/concepts">
          <span>Next</span>Concepts →
        </Link>
      </div>
    </article>
  );
}
