type PopularityRank = 1 | 2 | 3;

const medalPalette = {
  1: { tone: 'Золото', light: '#FFF2A8', main: '#F3B51B', dark: '#9A6500' },
  2: { tone: 'Серебро', light: '#F8FAFC', main: '#B8C2CF', dark: '#667382' },
  3: { tone: 'Бронза', light: '#FFD7B0', main: '#C77B3B', dark: '#7C3F16' },
} as const;

export function VehiclePopularityMedal({ rank }: { rank: PopularityRank }) {
  const palette = medalPalette[rank];
  const gradientId = `vehicle-popularity-medal-${rank}`;

  return (
    <svg
      role="img"
      aria-label={`${rank} место по количеству заказов`}
      data-medal-tone={palette.tone}
      data-medal-style="seal-ribbon"
      viewBox="0 0 48 58"
      className="size-9 overflow-visible drop-shadow-[0_2px_5px_rgba(15,23,42,0.25)] sm:size-10"
    >
      <title>{`${rank} место по количеству заказов`}</title>
      <defs>
        <linearGradient id={gradientId} x1="8" y1="4" x2="39" y2="43">
          <stop stopColor={palette.light} />
          <stop offset="0.5" stopColor={palette.main} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      <path d="m13 34-1 22 12-7 2-15Z" fill={palette.dark} />
      <path d="m35 34 1 22-12-7-2-15Z" fill={palette.main} />
      <path
        d="m24 3 3 2.2 3.7-.9 2.2 3.1 3.8.3.7 3.7 3.4 1.7-.9 3.7 2.2 3-2.2 3 .9 3.7-3.4 1.7-.7 3.7-3.8.3-2.2 3.1-3.7-.9-3 2.2-3-2.2-3.7.9-2.2-3.1-3.8-.3-.7-3.7-3.4-1.7.9-3.7-2.2-3 2.2-3-.9-3.7 3.4-1.7.7-3.7 3.8-.3 2.2-3.1 3.7.9Z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="24" cy="22" r="14.5" fill={`url(#${gradientId})`} stroke={palette.dark} strokeWidth="1" />
      <circle cx="24" cy="22" r="11.5" fill="none" stroke="rgba(255,255,255,.72)" />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontSize="18"
        fontWeight="900"
        fill="#172033"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="0.8"
        paintOrder="stroke"
      >
        {rank}
      </text>
    </svg>
  );
}
