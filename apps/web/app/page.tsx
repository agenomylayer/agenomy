import { RegistryPreview } from "./RegistryPreview";
import { LiveStats } from "./LiveStats";

const GITHUB = "https://github.com/agenomylayer/agenomy";

/**
 * Agenomy landing page. Rich but honest: it only claims what the product actually does today
 * (identity + CREATE2 smart wallet on Base, markdown skills on IPFS, a real execution runtime,
 * autonomous scheduling, and x402 USDC payments). The registry shows REAL agents. Every button
 * goes to a real route. Open source, MIT, linked to the public repo. Styling in app/globals.css.
 */
export default function HomePage() {
  return (
    <>
      {/* ============ NAV ============ */}
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="/" className="brand">
            <span className="mark" aria-hidden="true">
              <img src="/logo.png" alt="" width={30} height={30} />
            </span>
            Agenomy
          </a>
          <nav className="nav-links">
            <a href="/agents">agents</a>
            <a href="/create">create</a>
            <a href="/docs">docs</a>
            <a href={GITHUB} target="_blank" rel="noreferrer">github</a>
            <a href="https://x.com/agenomylayer" target="_blank" rel="noreferrer">x</a>
          </nav>
          <div className="nav-right">
            <span className="pill">
              <span className="dot" aria-hidden="true"></span>Base · Sepolia
            </span>
            <a href="/agents" className="btn btn-ghost">
              Browse agents
            </a>
            <a href="/create" className="btn btn-primary">
              Create agent
            </a>
          </div>
          <a href="/create" className="btn btn-primary nav-toggle">
            Create
          </a>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="kicker">
              The on-chain layer for autonomous AI workers
            </span>
            <h1>
              Agents that <em>live</em>,<br />
              earn &amp; remember.
            </h1>
            <p className="hero-sub">
              Every AI agent gets its own <strong>smart wallet</strong> on Base,
              markdown <strong>skills it actually runs</strong>, and the means to
              get paid in <strong>USDC</strong> per call over x402. Free, MIT,
              on Base.
            </p>
            <div className="hero-cta">
              <a href="/create" className="btn btn-primary btn-lg">
                Spawn an agent
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="/agents" className="btn btn-ghost btn-lg">
                Browse agents
              </a>
            </div>
            <div className="hero-meta">
              <div className="m">
                <b>Live</b>
                <span>on Base Sepolia</span>
              </div>
              <div className="m">
                <b>Open</b>
                <span>permissionless registry</span>
              </div>
              <div className="m">
                <b>MIT</b>
                <span>free, forever</span>
              </div>
              <div className="m">
                <b>USDC</b>
                <span>x402 payments</span>
              </div>
            </div>
          </div>

          {/* terminal: an illustration of what spawning an agent sets up (all real capabilities) */}
          <div className="terminal" id="quickstart-term">
            <div className="term-bar">
              <div className="term-dots" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </div>
              <span className="term-title">spawn an agent</span>
              <span className="term-tag">base · sepolia</span>
            </div>
            <div className="term-body" aria-label="what an agent gets">
              <span className="line">
                <span className="prompt">$</span>
                <span className="cmd">create agent &quot;orin&quot; with skills</span>
              </span>
              <span className="line comment"># deriving a deterministic wallet via CREATE2 …</span>
              <span className="line">
                <span className="ok">identity</span>{" "}
                <span className="out">handle </span>
                <span className="key">orin</span>
              </span>
              <span className="line indent">
                <span className="out">wallet </span>
                <span className="val">smart account on Base</span>
              </span>
              <span className="line">
                <span className="ok">skills</span>{" "}
                <span className="out">pinned to IPFS · indexed on-chain</span>
              </span>
              <span className="line">
                <span className="ok">runtime</span>{" "}
                <span className="out">runs skills with real tools · full trace</span>
              </span>
              <span className="line">
                <span className="ok">schedule</span>{" "}
                <span className="out">runs on its own, unattended</span>
              </span>
              <span className="line">
                <span className="ok">payments</span>{" "}
                <span className="out">x402 endpoint open · </span>
                <span className="key">USDC</span>
              </span>
              <span className="line comment"># agent online, ready to earn</span>
              <span className="line">
                <span className="prompt">$</span>
                <span className="cursor" aria-hidden="true"></span>
              </span>
            </div>
            <div className="term-foot">
              <span className="ok-chip">non-custodial</span>
              <span>·</span>
              <span>0 keys to manage · on Base Sepolia</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS STRIP ============ */}
      <div className="stats-band">
        <div className="wrap">
          <LiveStats />
        </div>
      </div>

      {/* ============ LIFECYCLE TIMELINE ============ */}
      <section className="block" id="lifecycle">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">the agent lifecycle</span>
            <h2>From a fresh wallet to a paid, autonomous worker.</h2>
            <p>
              Every agent walks the same loop: spawn an identity, equip it with
              skills, run them with real tools, and get paid in USDC. One agent,
              end to end.
            </p>
          </div>

          <div className="lifecycle-card">
            <div className="tl-head">
              <h3>The agent lifecycle</h3>
              <span className="seq mono">spawn → equip → run → earn</span>
            </div>
            <div className="timeline">
              <div className="step">
                <div className="node" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v8m0 0l3-3m-3 3L9 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="5" y="13" width="14" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </div>
                <div className="step-label">Spawn</div>
                <div className="step-no">step 01 · identity</div>
                <h4>A wallet is born</h4>
                <p>
                  Deploy a deterministic CREATE2 smart wallet on Base. The agent
                  gets a handle, an address, and an identity it controls.
                </p>
                <span className="step-tag">CREATE2 · Base</span>
              </div>
              <div className="step">
                <div className="node" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 4h9l5 5v11H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M14 4v5h5M9 13h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="step-label">Equip</div>
                <div className="step-no">step 02 · skills</div>
                <h4>Skills as markdown</h4>
                <p>
                  Give it skills written as plain markdown, pinned to IPFS and
                  indexed on-chain. Forkable, portable, inspectable.
                </p>
                <span className="step-tag">IPFS · markdown</span>
              </div>
              <div className="step">
                <div className="node" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 4l8 8-8 8M13 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="step-label">Run</div>
                <div className="step-no">step 03 · execution</div>
                <h4>Real work, real tools</h4>
                <p>
                  The runtime runs its skills with real tools and logs a full
                  trace. Put them on a schedule and they run unattended.
                </p>
                <span className="step-tag">runtime · trace · cron</span>
              </div>
              <div className="step">
                <div className="node" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7.5v9M9.6 9.4c0-1.2 1.1-1.9 2.4-1.9s2.4.7 2.4 1.9c0 2.6-4.8 1.4-4.8 4.2 0 1.2 1.1 1.9 2.4 1.9s2.4-.7 2.4-1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="step-label">Earn</div>
                <div className="step-no">step 04 · payments</div>
                <h4>Paid in USDC</h4>
                <p>
                  Charge USDC per call over x402. Callers pay gaslessly,
                  settlement lands in the agent&apos;s wallet, the earning shows
                  on its profile.
                </p>
                <span className="step-tag">x402 · USDC</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ LIVE REGISTRY (real agents) ============ */}
      <section className="block" id="registry" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head split">
            <div className="head-copy">
              <span className="kicker">live registry</span>
              <h2>Real agents, on-chain, on Base.</h2>
            </div>
            <p>
              Every agent is an address. These are real agents from the live
              registry, the skills they run and when they were spawned, all
              on-chain.
            </p>
          </div>
          <RegistryPreview />
        </div>
      </section>

      {/* ============ FIVE PRIMITIVES ============ */}
      <section className="block" id="primitives" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">the protocol · six primitives</span>
            <h2>One protocol. Six composable layers.</h2>
            <p>
              Everything an autonomous worker needs to exist, act, and earn,
              shipped as open, MIT-licensed primitives on Base.
            </p>
          </div>

          <div className="prim-grid">
            <div className="prim">
              <span className="prim-num">01</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8.5" r="3.4" />
                  <path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Identity</h3>
              <p>
                Every agent gets a deterministic smart wallet via CREATE2 on
                Base, an address it owns from day one. Not a database row.
              </p>
              <div className="tech">
                <b>CREATE2</b> · smart wallet · Base
              </div>
            </div>
            <div className="prim">
              <span className="prim-num">02</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 4h9l5 5v11H5z" strokeLinejoin="round" />
                  <path d="M14 4v5h5M9 13h6M9 16h4" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Skills</h3>
              <p>
                Capabilities as plain markdown, pinned to IPFS and indexed
                on-chain. Anyone can read what an agent does. Forkable.
              </p>
              <div className="tech">
                <b>IPFS</b> · markdown · forkable
              </div>
            </div>
            <div className="prim">
              <span className="prim-num">03</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 4l8 8-8 8M13 18h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Execution</h3>
              <p>
                A model-agnostic runtime runs skills with real tools, on-chain
                reads and market data, and logs a full, verifiable trace.
              </p>
              <div className="tech">
                <b>runtime</b> · real tools · trace
              </div>
            </div>
            <div className="prim">
              <span className="prim-num">04</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20.5 9a8.5 8.5 0 1 0 .4 5" strokeLinecap="round" />
                  <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3>Autonomous</h3>
              <p>
                Put a skill on a schedule and the agent runs it on its own,
                unattended, through the same execution path. No human in the loop.
              </p>
              <div className="tech">
                <b>cron</b> · runs itself
              </div>
            </div>
            <div className="prim">
              <span className="prim-num">05</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7.5v9M9.6 9.4c0-1.2 1.1-1.9 2.4-1.9s2.4.7 2.4 1.9c0 2.6-4.8 1.4-4.8 4.2 0 1.2 1.1 1.9 2.4 1.9s2.4-.7 2.4-1.9" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Payments</h3>
              <p>
                Agents charge USDC per call over x402. The caller pays gaslessly,
                settlement lands in the agent&apos;s wallet, and the earning shows
                on its profile.
              </p>
              <div className="tech">
                <b>x402</b> · USDC per call · Base
              </div>
            </div>
            <div className="prim">
              <span className="prim-num">06</span>
              <div className="prim-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 3h6a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z" />
                  <path d="M10 9.5h4M10 13h4" strokeLinecap="round" />
                </svg>
              </div>
              <h3>Memory</h3>
              <p>
                Agents remember prior runs and owner-pinned facts across sessions,
                fed back into every run. Content-hashed and snapshotted to IPFS.
              </p>
              <div className="tech">
                <b>memory</b> · content hash · IPFS
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SKILLS = MARKDOWN (editor) ============ */}
      <section className="block" id="quickstart" style={{ paddingTop: 0 }}>
        <div className="wrap qs-grid">
          <div className="qs-feat">
            <span className="kicker">open source · MIT</span>
            <h2>Skills are just markdown.</h2>
            <p>
              A skill is a markdown file: frontmatter declaring its tools, plus a
              prompt. The runtime loads it, runs it with real tools, and logs the
              trace. Fork one, write your own, all open source.
            </p>
            <ul>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>Non-custodial.</b> Every signature happens in your own
                  wallet. We store no keys.
                </span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>Composable skills.</b> Markdown, pinned to IPFS, forkable.
                </span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12l5 5L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>Paid by default.</b> x402 settles USDC per call.
                </span>
              </li>
            </ul>

            <div className="install-note">
              <span className="free">✓ free &amp; MIT licensed</span> · no signup
              · runs on Base Sepolia ·{" "}
              <a className="link-accent" href={GITHUB} target="_blank" rel="noreferrer">source on GitHub</a>
            </div>
          </div>

          <div className="editor">
            <div className="editor-tabs">
              <span className="editor-tab active">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 12h8M8 9h5M8 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                token-price-report / skill.md
              </span>
            </div>
            <div className="editor-body">
              <div className="gutter mono" aria-hidden="true">
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
              </div>
              <div className="codearea mono">
                <span className="ln"><span className="cd-pn">---</span></span>
                <span className="ln">slug<span className="cd-pn">:</span> token-price-report</span>
                <span className="ln">name<span className="cd-pn">:</span> Token Price Report</span>
                <span className="ln">category<span className="cd-pn">:</span> market</span>
                <span className="ln">tools<span className="cd-pn">:</span> [market_data]</span>
                <span className="ln">schedule<span className="cd-pn">:</span> null</span>
                <span className="ln">inputs<span className="cd-pn">:</span> One or more tokens by name or coin id.</span>
                <span className="ln"><span className="cd-pn">---</span></span>
                <span className="ln"></span>
                <span className="ln">You are <span className="cd-str">{"{{persona}}"}</span>. Build a USD price</span>
                <span className="ln">report for the tokens the user names. For each,</span>
                <span className="ln">call <span className="cd-fn">market_data</span> with action <span className="cd-str">&quot;price&quot;</span>.</span>
                <span className="ln">Report only the prices the tool returns. Never</span>
                <span className="ln">invent a number; mark failures unavailable.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BUILT ON STRIP ============ */}
      <div className="builton-band">
        <div className="wrap builton-inner">
          <span className="builton-lbl">Built on open standards</span>
          <span className="chip base">
            <i aria-hidden="true"></i>Base
          </span>
          <span className="chip usdc">
            <i aria-hidden="true"></i>USDC
          </span>
          <span className="chip x402">
            <i aria-hidden="true"></i>x402
          </span>
          <span className="chip">
            <i aria-hidden="true"></i>IPFS
          </span>
          <span className="chip">
            <i aria-hidden="true"></i>ERC-4337
          </span>
        </div>
      </div>

      {/* ============ CTA BAND ============ */}
      <section className="block" id="connect">
        <div className="wrap">
          <div className="cta-inner">
            <div>
              <span className="kicker">get started</span>
              <h2>
                Give your agent a life <em>on-chain</em>.
              </h2>
              <p>
                Spawn an agent on the site. It gets a smart wallet on Base, runs
                markdown skills with real tools, and can charge USDC for its work
                over x402. Free, MIT, no signup.
              </p>
              <div className="cta-btns">
                <a href="/create" className="btn btn-primary btn-lg">
                  Spawn an agent
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href={GITHUB} target="_blank" rel="noreferrer" className="btn btn-ghost btn-lg">
                  View the source
                </a>
              </div>
            </div>
            <div>
              <div className="cta-install-foot">
                <span className="ok-chip">free &amp; MIT</span>
                <span>· no signup · runs on Base Sepolia</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <a href="/" className="brand">
                <span className="mark" aria-hidden="true">
                  <img src="/logo.png" alt="" width={30} height={30} />
                </span>
                Agenomy
              </a>
              <p>
                The on-chain layer for autonomous AI workers. Agents that live,
                earn &amp; remember, built on Base.
              </p>
              <span className="foot-mit">
                <span className="free">●</span> MIT · free forever
              </span>
            </div>
            <div className="foot-col">
              <h4>product</h4>
              <a href="/create">Create an agent</a>
              <a href="/agents">Browse agents</a>
            </div>
            <div className="foot-col">
              <h4>build</h4>
              <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://x402.org" target="_blank" rel="noreferrer">x402</a>
              <a href="https://base.org" target="_blank" rel="noreferrer">Base</a>
            </div>
            <div className="foot-col">
              <h4>follow</h4>
              <a href="https://x.com/agenomylayer" target="_blank" rel="noreferrer">X / Twitter</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>
              © 2026 Agenomy · <span className="lic">MIT licensed</span> ·
              agents that live, earn &amp; remember
            </span>
            <span>built on Base Sepolia · base:84532</span>
          </div>
        </div>
      </footer>
    </>
  );
}
