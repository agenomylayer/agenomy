export function SkillChip({ slug }: { slug: string }) {
  return (
    <span
      className="inline-block rounded-full border border-line px-2 py-0.5 text-xs text-muted"
      data-testid="skill-chip"
    >
      {slug}
    </span>
  );
}
