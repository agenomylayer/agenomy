function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function AvatarBlob({
  seed,
  size = 48,
}: {
  seed: string;
  size?: number;
}) {
  const h = hashSeed(seed);
  const hue = h % 360;
  const hue2 = (h >> 3) % 360;
  const r = 6 + (h % 7);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`avatar for ${seed}`}
      data-testid="avatar-blob"
    >
      <rect
        width="48"
        height="48"
        rx={r}
        fill={`hsl(${hue} 45% 88%)`}
      />
      <circle
        cx={16 + (h % 16)}
        cy={16 + ((h >> 5) % 16)}
        r={10 + (h % 6)}
        fill={`hsl(${hue2} 55% 55%)`}
      />
    </svg>
  );
}
