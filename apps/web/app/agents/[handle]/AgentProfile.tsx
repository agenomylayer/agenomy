import Link from "next/link";
import type { AgentDetail } from "@agenomy/shared";
import { AvatarBlob } from "../../../src/components/AvatarBlob";
import { SkillChip } from "../../../src/components/SkillChip";
import { InvokePanel } from "./InvokePanel";
import { SchedulesPanel } from "./SchedulesPanel";
import { EarningsPanel } from "./EarningsPanel";
import { AgentRail } from "./AgentRail";
import { AgentStats } from "./AgentStats";
import { MemoryPanel } from "./MemoryPanel";
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
    <main className="page page--lg">
      <div className="ac-app">
        {/* ---------------- left rail ---------------- */}
        <AgentRail
          handle={agent.handle}
          displayName={agent.persona.displayName || agent.handle}
          avatarSeed={agent.persona.avatarSeed || agent.handle}
        />

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
              <AgentStats handle={agent.handle} skillCount={agent.skills.length} />
            </div>

            {agent.skills.length > 0 && (
              <div className="ac-heroskills">
                <span className="lbl">Skills</span>
                {agent.skills.map((s) => (
                  <SkillChip key={s} slug={s} />
                ))}
              </div>
            )}

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

          {/* run + recent runs */}
          <InvokePanel handle={agent.handle} />

          {/* schedules + earnings */}
          <div className="ac-lower">
            <SchedulesPanel handle={agent.handle} />
            <EarningsPanel handle={agent.handle} owner={agent.owner} />
          </div>

          {/* memory */}
          <MemoryPanel handle={agent.handle} owner={agent.owner} ipfsGateway={ipfsGateway} />

          <div className="ac-foot">
            Agenomy <span className="mono">·</span> the on-chain layer for autonomous AI workers
          </div>
        </div>
      </div>
    </main>
  );
}
