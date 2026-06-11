import Link from "next/link";
import type { AgentSummary } from "@aeonomy/shared";
import { AvatarBlob } from "./AvatarBlob";
import { SkillChip } from "./SkillChip";
import { shortAddress, formatCreatedAt } from "./format";

export function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <AvatarBlob seed={agent.handle} />
        <Link
          href={`/agents/${agent.handle}`}
          className="text-lg font-medium text-ink hover:underline"
        >
          {agent.handle}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1">
        {agent.skills.map((slug) => (
          <SkillChip key={slug} slug={slug} />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{shortAddress(agent.wallet)}</span>
        <time dateTime={String(agent.createdAt)}>
          {formatCreatedAt(agent.createdAt)}
        </time>
      </div>
    </article>
  );
}
