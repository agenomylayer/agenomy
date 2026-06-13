import Link from "next/link";
import type { AgentSummary } from "@agenomy/shared";
import { AvatarBlob } from "./AvatarBlob";
import { SkillChip } from "./SkillChip";
import { shortAddress, formatCreatedAt } from "./format";

export function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <article className="agent-card">
      <div className="ac-top">
        <AvatarBlob seed={agent.handle} size={44} />
        <div className="ac-id">
          <Link href={`/agents/${agent.handle}`} className="ac-handle">
            {agent.handle}
          </Link>
          <div className="ac-wallet">{shortAddress(agent.wallet)}</div>
        </div>
      </div>
      <div className="ac-skills">
        {agent.skills.map((slug) => (
          <SkillChip key={slug} slug={slug} />
        ))}
      </div>
      <div className="ac-foot">
        <time className="ac-wallet" dateTime={String(agent.createdAt)}>
          {formatCreatedAt(agent.createdAt)}
        </time>
      </div>
    </article>
  );
}
