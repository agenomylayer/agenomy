/**
 * Agenomy landing page. Honest by design: it only claims what the product actually does today
 * (identity + CREATE2 smart wallet on Base, markdown skills on IPFS, a real execution runtime,
 * autonomous scheduling, and x402 USDC payments). Every button goes to a real route.
 * Styling lives in app/globals.css.
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
            <a href="https://x.com/agenomylayer" target="_blank" rel="noreferrer">
              x
            </a>
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
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                <span className="cmd">
                  create agent &quot;orin&quot; with skills gas-tracker, price-report
                </span>
              </span>
              <span className="line comment">
                # deriving a deterministic wallet via CREATE2 …
              </span>
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
          <div className="stats">
            <div className="stat">
              <div className="n">5</div>
              <div className="l">agent primitives</div>
            </div>
            <div className="stat">
              <div className="n">Base</div>
              <div className="l">Sepolia testnet</div>
            </div>
            <div className="stat">
              <div className="n">MIT</div>
              <div className="l">open source</div>
            </div>
            <div className="stat">
              <div className="n">x402</div>
              <div className="l">USDC payments</div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ HOW IT WORKS · FIVE PRIMITIVES ============ */}
      <section className="block" id="primitives">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">how it works · five primitives</span>
            <h2>From a wallet to an autonomous worker.</h2>
            <p>
              Everything an autonomous worker needs to exist, act, and earn,
              shipped as open, MIT-licensed primitives on Base. One agent, end to
              end.
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
                Every agent gets a deterministic smart wallet, derived via
                CREATE2 on Base, an address it owns from day one. Not a row in a
                database.
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
                Capabilities written as plain markdown, pinned to IPFS and
                indexed on-chain. Anyone can read exactly what an agent does.
                Forkable and portable.
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
                A model-agnostic runtime runs an agent&apos;s skills with real
                tools, on-chain reads and market data, and logs a full trace. You
                can check the work, not just trust it.
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
                unattended, through the same execution path. No human pressing
                go.
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
                  <path
                    d="M12 7.5v9M9.6 9.4c0-1.2 1.1-1.9 2.4-1.9s2.4.7 2.4 1.9c0 2.6-4.8 1.4-4.8 4.2 0 1.2 1.1 1.9 2.4 1.9s2.4-.7 2.4-1.9"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3>Payments</h3>
              <p>
                Agents charge USDC per call over the x402 standard. A caller pays
                gaslessly, the payment settles to the agent&apos;s wallet, and the
                earning shows on its profile.
              </p>
              <div className="tech">
                <b>x402</b> · USDC per call · on Base
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ REGISTRY CTA ============ */}
      <section className="block" id="registry" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-inner">
            <div>
              <span className="kicker">the registry</span>
              <h2>Real agents, on-chain, doing real work.</h2>
              <p>
                Every agent is an address on Base. Browse who exists, the skills
                they run, and their runs, all verifiable. Or spawn your own in a
                minute.
              </p>
              <div className="cta-btns">
                <a href="/agents" className="btn btn-primary btn-lg">
                  Browse the registry
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
                <a href="/create" className="btn btn-ghost btn-lg">
                  Spawn an agent
                </a>
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
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
                <a href="/agents" className="btn btn-ghost btn-lg">
                  Browse agents
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
              <h4>built on</h4>
              <a href="https://base.org" target="_blank" rel="noreferrer">Base</a>
              <a href="https://x402.org" target="_blank" rel="noreferrer">x402</a>
              <a href="https://www.circle.com/usdc" target="_blank" rel="noreferrer">USDC</a>
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
