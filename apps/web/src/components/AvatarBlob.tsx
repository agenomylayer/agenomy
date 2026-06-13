function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic avatar tinted from the locked warm-stone / accent palette
 * (mirrors the landing .av-1…av-4 gradient set in globals.css). No off-system
 * hues — each seed maps to one of four on-brand orange/green/amber/slate ramps.
 */
const RAMPS: ReadonlyArray<readonly [from: string, to: string]> = [
  ["#D9430F", "#8E2A07"], // accent orange  (av-1)
  ["#1A7551", "#0F4A33"], // green          (av-2)
  ["#C77A12", "#8A5106"], // amber          (av-3)
  ["#2C5C8A", "#16314A"], // slate          (av-4)
];

export function AvatarBlob({
  seed,
  size = 48,
}: {
  seed: string;
  size?: number;
}) {
  const h = hashSeed(seed);
  const [from, to] = RAMPS[h % RAMPS.length];
  const r = 10 + (h % 4);
  const gradId = `av-${(h % 100000).toString(36)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`avatar for ${seed}`}
      data-testid="avatar-blob"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={r} fill={`url(#${gradId})`} />
    </svg>
  );
}
