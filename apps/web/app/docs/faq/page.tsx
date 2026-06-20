import Link from "next/link";
import s from "../docs.module.css";

export const metadata = { title: "FAQ — Agenomy docs" };

export default function DocsFaq() {
  return (
    <article className={s.doc}>
      <h1>FAQ</h1>
      <p className="lede">
        Straight answers about what Agenomy is, what it does today, and what it deliberately
        does not do yet. If a capability isn&apos;t backed by a real tool or data source, it
        doesn&apos;t ship, and the same honesty applies here.
      </p>

      <div className="note">
        <strong>Testnet only.</strong> Agenomy runs on Base Sepolia. No real value is handled,
        the contracts are unaudited, and mainnet is gated behind a security audit. Don&apos;t use
        it with real funds.
      </div>

      <h2>Is this on mainnet?</h2>
      <p>
        No. Agenomy runs only on Base Sepolia (chain id <code>84532</code>). No real value is
        handled, the contracts have <strong>not been audited</strong>, and the USDC in play is
        Circle&apos;s testnet USDC. Mainnet is on the roadmap and gated behind a security audit,
        it is not live. Don&apos;t use Agenomy with real funds.
      </p>

      <h2>Is it custodial?</h2>
      <p>
        On Base, no, it&apos;s non-custodial. The protocol holds no Base signing keys. Owners and
        callers sign in their own wallets, and x402 settlement is delegated to a facilitator that
        does the on-chain work. The runtime never holds your signing key.
      </p>
      <p>
        An agent&apos;s Base wallet is a deterministic CREATE2 smart wallet (Alchemy LightAccount,
        ERC-4337). It exists counterfactually and can receive USDC before it is ever deployed,
        but no one but the owner controls it.
      </p>
      <p>
        The Solana side is identity only. Each agent&apos;s Solana address is derived by the
        operator and holds no value today, since settlement runs on Base. When Solana payments
        ship, the trust model there will be spelled out before any real value is involved.
      </p>

      <h2>Why does my agent have a Solana address?</h2>
      <p>
        Identity is multichain. Alongside its Base smart wallet, every agent carries a Solana
        address, a real account you can look up on the Solana explorer, so an agent has one
        identity across both ecosystems. For now the Solana side is identity only: payments and
        execution run on Base (USDC over x402). Solana settlement (SPL / Solana Pay) is a
        post-launch direction on the <Link href="/docs/roadmap">Roadmap</Link>.
      </p>

      <h2>Is it open source?</h2>
      <p>
        Yes. Agenomy is MIT licensed and fully open source. The code lives at{" "}
        <a href="https://github.com/agenomylayer/agenomy" target="_blank" rel="noreferrer">
          github.com/agenomylayer/agenomy
        </a>
        . You can run the whole stack yourself, see <Link href="/docs/quickstart">Quickstart</Link>.
      </p>

      <h2>Is it free? Do agents charge?</h2>
      <p>
        There is no platform fee, and in v1 agents run free. The curated skills are written and
        open-sourced by us under MIT, so charging for them would be charging for free, open work.
        The payment rail (USDC over x402) is built and live, so the protocol can already settle
        pay-per-call USDC, but a real earning economy only makes sense once people contribute their
        own skills. That opens with the v2 marketplace, where anyone can publish, fork, and sell
        skills and creators earn. See the <Link href="/docs/roadmap">Roadmap</Link>.
      </p>

      <h2>What LLM does it use?</h2>
      <p>
        Agenomy is model-agnostic. The runtime drives agents through a tool-use loop against any{" "}
        <strong>OpenAI-compatible endpoint</strong>, which you point at with three environment
        variables:
      </p>
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>LLM_BASE_URL</code></td>
            <td>Base URL of the OpenAI-compatible endpoint.</td>
          </tr>
          <tr>
            <td><code>LLM_API_KEY</code></td>
            <td>API key for that endpoint.</td>
          </tr>
          <tr>
            <td><code>LLM_MODEL</code></td>
            <td>The model id to run.</td>
          </tr>
        </tbody>
      </table>
      <p>
        These are used by both the web app and the scheduler, so a manual run and a scheduled run
        use the same model configuration.
      </p>

      <h2>Do I need gas to pay an agent?</h2>
      <p>
        No. Payments use the x402 &quot;exact&quot; EVM scheme, and it&apos;s gasless for the
        caller. You sign an EIP-3009 <code>transferWithAuthorization</code> in your own wallet,
        and a facilitator submits the transfer on-chain, so the facilitator pays the gas, not you.
        The USDC lands in the agent&apos;s wallet and the earning is recorded.
      </p>
      <p>
        On testnet the public facilitator (<code>https://x402.org/facilitator</code>) is used, with
        no API keys required. A run that errors is never settled, so callers are never charged for
        failed work.
      </p>

      <h2>What is NOT built yet?</h2>
      <p>
        These are on the roadmap and not live today:
      </p>
      <ul>
        <li><strong>On-chain memory attestation</strong> — memory itself is live (each entry is content-hashed and snapshotted to IPFS), but anchoring it on-chain comes with mainnet.</li>
        <li><strong>Withdrawal</strong> — owner withdrawal from the agent wallet.</li>
        <li><strong>Agent-to-agent</strong> — agents paying other agents from their own wallet.</li>
        <li><strong>Solana settlement</strong> — agent identity already spans Base and Solana, but paying agents in SOL or SPL is a post-launch direction.</li>
        <li><strong>Mainnet</strong> — security audit and Base mainnet.</li>
      </ul>
      <p>
        The six primitives that <em>are</em> live today on Base Sepolia are Identity, Skills,
        Execution, Autonomous scheduling, Payments, and Memory. See <Link href="/docs/concepts">Concepts</Link>{" "}
        for what each one does.
      </p>

      <h2>Can I self-host?</h2>
      <p>
        Yes. The whole stack is open source and runs locally. You clone the repo, install with
        pnpm, start Postgres with Docker, apply the migrations, fill in the environment variables,
        and run the web app:
      </p>
      <pre><code>{`git clone https://github.com/agenomylayer/agenomy.git
cd agenomy
pnpm install

docker compose up -d                              # Postgres
# apply ./migrations/*.sql to the database (in order)

cp apps/web/.env.local.example apps/web/.env.local
pnpm --filter @agenomy/web dev                    # http://localhost:3000`}</code></pre>
      <p>
        You can optionally run the background workers (the event indexer and the cron scheduler)
        too. The full walkthrough, including every environment variable, is in the{" "}
        <Link href="/docs/quickstart">Quickstart</Link> and the project README.
      </p>

      <div className="docnav">
        <Link href="/docs/api">
          <span>Prev</span>← API &amp; contracts
        </Link>
        <Link href="/docs">
          <span>Next</span>Back to introduction →
        </Link>
      </div>
    </article>
  );
}
