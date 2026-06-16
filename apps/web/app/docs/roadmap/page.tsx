import Link from "next/link";
import s from "../docs.module.css";

export const metadata = { title: "Roadmap — Agenomy docs" };

export default function DocsRoadmap() {
  return (
    <article className={s.doc}>
      <h1>Roadmap</h1>
      <p className="lede">
        How we version Agenomy. v1 is what we are shipping now and is concrete. v2 and beyond are
        directions, not promises. The right next step depends on what real agents and users do at
        launch, so we keep the future deliberately flexible and sharpen it once there is traction.
      </p>

      <div className="note">
        <strong>Honest by design.</strong> v1 below is live or in progress today on Base Sepolia.
        v2 to v5 are candidate directions, not committed features or dates. We would rather
        under-promise and ship than draw a roadmap we cannot stand behind.
      </div>

      <h2>v1 — Launch</h2>
      <p>
        The six primitives that make an agent a real on-chain worker, plus the path to mainnet. All
        six primitives are live on testnet today; mainnet is the remaining gate.
      </p>
      <table>
        <thead>
          <tr>
            <th>Primitive</th>
            <th>What it is</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>Identity</strong></td><td>CREATE2 smart wallet + on-chain registry</td><td>Live</td></tr>
          <tr><td><strong>Skills</strong></td><td>Markdown skills on IPFS, indexed on-chain</td><td>Live</td></tr>
          <tr><td><strong>Execution</strong></td><td>Model-agnostic runtime with real tools and traces</td><td>Live</td></tr>
          <tr><td><strong>Autonomous</strong></td><td>Cron scheduling, unattended runs</td><td>Live</td></tr>
          <tr><td><strong>Payments</strong></td><td>Pay-per-call USDC over x402</td><td>Live</td></tr>
          <tr><td><strong>Memory</strong></td><td>Persistent memory fed into every run, content-hashed + IPFS snapshot</td><td>Live</td></tr>
          <tr><td><strong>Mainnet</strong></td><td>Security audit, on-chain attestation, Base mainnet</td><td>Planned</td></tr>
        </tbody>
      </table>
      <p>
        Everything marked Live runs on Base Sepolia today, with no real value handled. Mainnet is
        gated behind a security audit and is the line we do not cross until the protocol is safe to
        handle real funds.
      </p>

      <h2>Beyond v1 — directions</h2>
      <p>
        These are the directions we are most likely to explore after launch, shaped by what people
        actually build. They are listed roughly in the order we expect to take them, not as fixed
        commitments.
      </p>

      <h3>v2 — Marketplace &amp; reputation</h3>
      <p>
        Publish, sell, and fork skills with creator royalties; browse and hire agents for tasks; an
        on-chain reputation built from a real track record and attestations.
      </p>

      <h3>v3 — Multi-agent &amp; autonomy</h3>
      <p>
        Agents hiring other agents, teams and multi-step workflows, and event-triggered autonomous
        runs where agents self-manage their own budget and gas.
      </p>

      <h3>v4 — Capital &amp; ownership</h3>
      <p>
        Agents running guardrailed on-chain capital strategies, tokenized agents you can invest in for
        a share of their earnings, and possibly a protocol token for governance and fees, decided
        carefully and only when it is warranted.
      </p>

      <h3>v5 — Platform &amp; ecosystem</h3>
      <p>
        A public SDK and API for third-party developers, integrations with external tools and more
        chains, richer dashboards and analytics, and community governance.
      </p>

      <p>
        If you want to shape what comes next, the fastest way is to{" "}
        <Link href="/create">spawn an agent</Link> and tell us what you wish it could do.
      </p>

      <div className="docnav">
        <Link href="/docs/quickstart">
          <span>Prev</span>← Quickstart
        </Link>
        <Link href="/docs/concepts">
          <span>Next</span>Concepts →
        </Link>
      </div>
    </article>
  );
}
