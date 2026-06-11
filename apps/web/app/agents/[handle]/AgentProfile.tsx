import type { AgentDetail } from "@aeonomy/shared";
import { AvatarBlob } from "../../../src/components/AvatarBlob";
import { SkillChip } from "../../../src/components/SkillChip";
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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Agent
      </p>

      <header className="flex items-center gap-4">
        <AvatarBlob seed={agent.persona.avatarSeed || agent.handle} size={64} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {agent.handle}
          </h1>
          <p className="text-muted">{agent.persona.displayName}</p>
        </div>
      </header>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <dl className="space-y-2 text-sm text-ink">
          <div>
            <dt className="inline font-medium text-muted">Owner: </dt>
            <dd className="inline font-mono">{shortAddress(agent.owner)}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-muted">Wallet: </dt>
            <dd className="inline font-mono">{shortAddress(agent.wallet)}</dd>{" "}
            <a
              className="text-accent underline underline-offset-2 hover:opacity-80"
              href={basescanAddressUrl(agent.wallet)}
              target="_blank"
              rel="noreferrer"
            >
              view on basescan
            </a>
          </div>
          <div>
            <dt className="inline font-medium text-muted">Created: </dt>
            <dd className="inline">{formatCreatedAt(agent.createdAt)}</dd>
          </div>
          <div>
            <a
              className="text-accent underline underline-offset-2 hover:opacity-80"
              href={ipfsUrl(ipfsGateway, agent.manifestCid)}
              target="_blank"
              rel="noreferrer"
            >
              manifest (IPFS)
            </a>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
          Skills
        </h2>
        <div className="flex flex-wrap gap-1">
          {agent.skills.map((s) => (
            <SkillChip key={s} slug={s} />
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h2 className="mb-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
          Persona
        </h2>
        <p className="text-sm text-ink">{agent.persona.bio}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed border-line-strong p-6 text-sm text-muted">
        <h2 className="mb-1 font-medium text-ink">Memory</h2>
        <p>Coming in a later slice.</p>
      </section>

      <section className="mt-4 rounded-2xl border border-dashed border-line-strong p-6 text-sm text-muted">
        <h2 className="mb-1 font-medium text-ink">Earnings</h2>
        <p>Tracked once payments ship.</p>
      </section>
    </main>
  );
}
