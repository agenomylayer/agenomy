import Link from "next/link";
import s from "../docs.module.css";

export const metadata = { title: "Skills — Agenomy docs" };

export default function DocsSkills() {
  return (
    <article className={s.doc}>
      <h1>Skills</h1>
      <p className="lede">
        A skill is a capability written as plain markdown: frontmatter that declares what it is and
        which tools it may call, followed by a prompt body the runtime feeds to the model. Skills
        are forkable, portable, and inspectable, no black box. They live in the open catalog under{" "}
        <code>skills/</code> and are read from disk at run time.
      </p>

      <div className="note">
        <strong>Testnet only.</strong> Agenomy runs on Base Sepolia and the contracts are
        unaudited. The tools a skill can call only read public on-chain and market data, see below.
      </div>

      <h2>The skill file</h2>
      <p>
        A skill is a single markdown file at <code>skills/&lt;slug&gt;/skill.md</code>. It has two
        parts: YAML frontmatter (between the <code>---</code> fences) and the prompt body underneath.
        The body is the prompt; <code>{"{{persona}}"}</code> is replaced with the agent&apos;s
        persona at run time. Skills are read from disk when a run starts, so adding a skill needs no
        rebuild.
      </p>

      <h2>Frontmatter</h2>
      <p>The frontmatter describes the skill and is validated by the loader when it parses:</p>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Required</th>
            <th>What it is</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>slug</code></td>
            <td>yes</td>
            <td>Unique id for the skill.</td>
          </tr>
          <tr>
            <td><code>name</code></td>
            <td>yes</td>
            <td>Display name.</td>
          </tr>
          <tr>
            <td><code>category</code></td>
            <td>yes</td>
            <td>
              A grouping label, e.g. <code>onchain</code>, <code>market</code>,{" "}
              <code>content</code>, <code>analysis</code>.
            </td>
          </tr>
          <tr>
            <td><code>tools</code></td>
            <td>no</td>
            <td>
              List of tools the skill may call, validated against the tool registry. A skill that
              declares an unknown tool fails to load. Omit it for a skill that calls no tools.
            </td>
          </tr>
          <tr>
            <td><code>schedule</code></td>
            <td>no</td>
            <td>
              A cron string for autonomous runs, or <code>null</code> (also the default when
              omitted) for on-demand only.
            </td>
          </tr>
          <tr>
            <td><code>inputs</code></td>
            <td>yes</td>
            <td>A human description of the input the skill expects.</td>
          </tr>
        </tbody>
      </table>
      <p>
        The four required fields are <code>slug</code>, <code>name</code>, <code>category</code>,
        and <code>inputs</code>. If any are missing, or if a declared tool is not in the registry,
        or if the prompt body is empty, the skill is rejected at load time.
      </p>

      <h2>Tools</h2>
      <p>
        A skill can only call tools that exist in the runtime&apos;s tool registry. Two are
        available today, both read-only:
      </p>
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>What it reads</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>onchain_read</code></td>
            <td>ETH and ERC-20 balances, and the current gas price.</td>
            <td>Base RPC</td>
          </tr>
          <tr>
            <td><code>market_data</code></td>
            <td>Token prices and TVL.</td>
            <td>DeFiLlama</td>
          </tr>
        </tbody>
      </table>
      <p>
        The runtime drives the agent through a tool-use loop: the model calls a tool, the runtime
        executes it, the result feeds back, and so on until the model produces a final answer. Every
        tool call and result is recorded as a verifiable trace. See{" "}
        <Link href="/docs/quickstart">Quickstart</Link> for running a skill end to end.
      </p>

      <h2>A real skill</h2>
      <p>
        This is <code>skills/token-price-report/skill.md</code> from the catalog, verbatim. The
        prompt is deliberately strict: it reports only what the tool returns and never invents a
        number.
      </p>
      <pre>
        <code>{`---
slug: token-price-report
name: Token Price Report
category: market
tools:
  - market_data
schedule: null
inputs: >-
  One or more tokens by name or DeFiLlama coin id (e.g. "ETH, USDC, AERO" or
  "coingecko:ethereum").
---
You are {{persona}}. Build a clean USD price report for the tokens the user names.

For each token, call the market_data tool with action "price" using a DeFiLlama coin id. Map common tickers to ids when obvious (ETH -> coingecko:ethereum, BTC -> coingecko:bitcoin, USDC -> coingecko:usd-coin, AERO -> coingecko:aerodrome-finance). If you are unsure of the correct coin id for a ticker, say so and ask the user to supply the exact DeFiLlama coin id rather than guessing.

Report ONLY the USD prices the tool returns. Never invent or estimate a price, and do not state market cap, volume, 24h change, or any metric the tool does not provide — you do not have that data. Present results as a tidy list: token -> price (USD). If a lookup fails, mark that token as unavailable and continue with the rest. Keep it short and skimmable for a Base/crypto builder.`}</code>
      </pre>
      <p>
        The catalog also ships <code>skills/base-gas-check/skill.md</code> (category{" "}
        <code>onchain</code>, tool <code>onchain_read</code>), which fetches the current Base gas
        price and reports only the value the tool returns.
      </p>

      <h2>Add or fork a skill</h2>
      <p>
        Adding a skill is just dropping a folder in <code>skills/</code>. Create the directory,
        write a <code>skill.md</code> with valid frontmatter and a prompt body, and the runtime picks
        it up, no rebuild required since skills are read from disk at run time.
      </p>
      <pre>
        <code>{`skills/
  my-skill/
    skill.md`}</code>
      </pre>
      <p>
        To fork an existing skill, copy its folder under a new <code>slug</code> and edit the prompt
        or tools to taste. Keep it honest: only declare tools that exist in the registry, and only
        promise what those tools can actually return. A skill that asks the model to state data no
        tool provides is the kind of thing that doesn&apos;t ship here.
      </p>

      <div className="docnav">
        <Link href="/docs/quickstart">
          <span>Prev</span>← Quickstart
        </Link>
        <Link href="/docs/payments">
          <span>Next</span>Payments (x402) →
        </Link>
      </div>
    </article>
  );
}
