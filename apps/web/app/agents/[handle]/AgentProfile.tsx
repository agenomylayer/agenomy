import type { AgentDetail } from "@agenomy/shared";
import { AvatarBlob } from "../../../src/components/AvatarBlob";
import { SkillChip } from "../../../src/components/SkillChip";
import { InvokePanel } from "./InvokePanel";
import { SchedulesPanel } from "./SchedulesPanel";
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
    <main className="page page--md">
      <span className="kicker">agent</span>

      <header className="page-head" style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "14px" }}>
        <AvatarBlob seed={agent.persona.avatarSeed || agent.handle} size={64} />
        <div>
          <h1 className="page-title" style={{ marginTop: 0 }}>
            {agent.handle}
          </h1>
          <p className="muted-note">{agent.persona.displayName}</p>
        </div>
      </header>

      <section className="card">
        <dl className="kv">
          <div>
            <span className="k">Owner </span>
            <span className="v mono">{shortAddress(agent.owner)}</span>
          </div>
          <div>
            <span className="k">Wallet </span>
            <span className="v mono">{shortAddress(agent.wallet)}</span>{" "}
            <a
              className="link-accent"
              href={basescanAddressUrl(agent.wallet)}
              target="_blank"
              rel="noreferrer"
            >
              view on basescan
            </a>
          </div>
          <div>
            <span className="k">Created </span>
            <span className="v">{formatCreatedAt(agent.createdAt)}</span>
          </div>
          <div>
            <a
              className="link-accent"
              href={ipfsUrl(ipfsGateway, agent.manifestCid)}
              target="_blank"
              rel="noreferrer"
            >
              manifest (IPFS)
            </a>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="card-label">Skills</h2>
        <div className="ac-skills" style={{ margin: 0 }}>
          {agent.skills.map((s) => (
            <SkillChip key={s} slug={s} />
          ))}
        </div>
      </section>

      <InvokePanel handle={agent.handle} />

      <SchedulesPanel handle={agent.handle} />

      <section className="card">
        <h2 className="card-label">Persona</h2>
        <p style={{ fontSize: "14.5px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
          {agent.persona.bio}
        </p>
      </section>

      <section className="card card-placeholder">
        <h2 className="card-label" style={{ marginBottom: "6px" }}>Memory</h2>
        <p className="muted-note">Coming in a later slice.</p>
      </section>

      <section className="card card-placeholder">
        <h2 className="card-label" style={{ marginBottom: "6px" }}>Earnings</h2>
        <p className="muted-note">Coming in a later slice.</p>
      </section>
    </main>
  );
}
