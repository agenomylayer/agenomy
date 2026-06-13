export function SkillChip({ slug }: { slug: string }) {
  return (
    <span className="skilltag" data-testid="skill-chip">
      {slug}
    </span>
  );
}
