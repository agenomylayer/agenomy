import Link from "next/link";
import type { AgentDetail } from "@agenomy/shared";
import { AvatarBlob } from "../../../src/components/AvatarBlob";
import { SkillChip } from "../../../src/components/SkillChip";
import { InvokePanel } from "./InvokePanel";
import { SchedulesPanel } from "./SchedulesPanel";
import { EarningsPanel } from "./EarningsPanel";
import {
  shortAddress,
  formatCreatedAt,
  basescanAddressUrl,
  ipfsUrl,
} from "../../../src/components/format";

const I = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  run: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 4 20 12 6 20 6 4" /></svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
  ),
  coin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.2 9.4a2.5 2.5 0 0 1 2.8-1.4c1.6.2 2.4 1.3 2.2 2.4c-.3 1.6-3.6 1.3-3.9 3c-.2 1.1.7 2.2 2.3 2.4a2.5 2.5 0 0 0 2.8-1.4" /></svg>
  ),
  chip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6a2 2 0 0 1 2 2v2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V5a2 2 0 0 1 2-2Z" /><path d="M10 9.5h4M10 13h4" /></svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z" /></svg>
  ),
};

export function AgentProfile({
  agent,
  ipfsGateway,
}: {
  agent: AgentDetail;
  ipfsGateway: string;
}) {
  return (
    <main className="page page--lg">
      <div className="ac-app">
        {/* ---------------- left rail ---------------- */}
        <aside className="ac-rail">
          <div className="ac-railagent">
            <span className="ac-railavatar">
              <AvatarBlob seed={agent.persona.avatarSeed || agent.handle} size={38} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="nm">{agent.persona.displayName || agent.handle}</div>
              <div className="hd">{agent.handle}</div>
            </div>
          </div>

          <nav className="ac-nav">
            <div className="ac-navlabel">Agent</div>
            <a className="ac-navitem on" href="#overview">{I.overview}Overview</a>
            <a className="ac-navitem" href="#run">{I.run}Run</a>
            <a className="ac-navitem" href="#schedules">{I.clock}Schedules</a>
            <a className="ac-navitem" href="#earnings">{I.coin}Earnings</a>
            <a className="ac-navitem" href="#memory">{I.chip}Memory<span className="nt">soon</span></a>
          </nav>

          <div className="ac-railfoot">
            <span className="ac-dotok" aria-hidden="true" />
            Live on Base Sepolia
          </div>
        </aside>

        {/* ---------------- main column ---------------- */}
        <div className="ac-main">
          <div className="ac-crumbs">
            <Link href="/agents">Agents</Link>
            <span className="sep">·</span>
            <span className="cur mono">{agent.handle}</span>
          </div>

          {/* hero / overview */}
          <section className="ac-hero" id="overview">
            <div className="ac-herotop">
              <span className="ac-heroavatar">
                <AvatarBlob seed={agent.persona.avatarSeed || agent.handle} size={62} />
              </span>
              <div className="ac-heroid">
                <div className="ac-herotitle">
                  <h1>{agent.persona.displayName || agent.handle}</h1>
                  <span className="ac-herohandle">@{agent.handle}</span>
                </div>
                {agent.persona.bio && <p className="ac-bio">{agent.persona.bio}</p>}
                <div className="ac-nets">
                  <span className="ac-chipnet"><span className="pulse" />Base</span>
                  <span className="ac-chipnet test"><span className="pulse" />Sepolia testnet</span>
                </div>
              </div>
            </div>

            <div className="ac-facts">
              <div className="ac-fact">
                <div className="k">Owner</div>
                <div className="v mono">{shortAddress(agent.owner)}</div>
              </div>
              <div className="ac-fact">
                <div className="k">Wallet</div>
                <div className="v mono">
                  {shortAddress(agent.wallet)}{" "}
                  <a href={basescanAddressUrl(agent.wallet)} target="_blank" rel="noreferrer">basescan</a>
                </div>
              </div>
              <div className="ac-fact">
                <div className="k">Created</div>
                <div className="v">{formatCreatedAt(agent.createdAt)}</div>
              </div>
              <div className="ac-fact">
                <div className="k">Manifest</div>
                <div className="v">
                  <a href={ipfsUrl(ipfsGateway, agent.manifestCid)} target="_blank" rel="noreferrer">IPFS</a>
                </div>
              </div>
            </div>
          </section>

          {/* skills */}
          <section className="ac-card" id="skills">
            <div className="ac-sechead">
              <div className="ac-sectitle">
                <span className="ac-secic">{I.spark}</span>
                <h2>Skills</h2>
              </div>
              <span className="ac-secsub">{agent.skills.length} installed</span>
            </div>
            <div className="ac-skills">
              {agent.skills.map((s) => (
                <SkillChip key={s} slug={s} />
              ))}
            </div>
          </section>

          {/* run + recent runs */}
          <InvokePanel handle={agent.handle} />

          {/* schedules + earnings */}
          <div className="ac-lower">
            <SchedulesPanel handle={agent.handle} />
            <EarningsPanel handle={agent.handle} owner={agent.owner} />
          </div>

          {/* memory */}
          <section id="memory">
            <div className="ac-memory">
              <div className="ac-memicon">{I.chip}</div>
              <h3>Memory</h3>
              <p>Persistent context so {agent.handle} remembers prior runs, watched tokens, and thresholds across sessions.</p>
              <span className="soon">Coming in a later slice</span>
            </div>
          </section>

          <div className="ac-foot">
            Agenomy <span className="mono">·</span> the on-chain layer for autonomous AI workers
          </div>
        </div>
      </div>
    </main>
  );
}
