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
      viewBox="0 0 48 58"
      className="size-11 overflow-visible drop-shadow-[0_3px_7px_rgba(15,23,42,0.28)] sm:size-12"
    >
      <title>{`${rank} место по количеству заказов`}</title>
      <defs>
        <linearGradient id={gradientId} x1="8" y1="4" x2="39" y2="43">
          <stop stopColor={palette.light} />
          <stop offset="0.5" stopColor={palette.main} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      <path d="M12 35 9 56l15-8 15 8-3-21Z" fill={palette.dark} />
      <circle cx="24" cy="23" r="20" fill={`url(#${gradientId})`} />
      <circle cx="24" cy="23" r="16.5" fill="none" stroke="rgba(255,255,255,.7)" />
      <path
        d="m24 7 3.2 5.1 5.8-1.4.5 6 5.6 2.2-2.3 5.5 4.1 4.3-4.8 3.5 1 5.9-6-.2-3 5.2-5.3-2.8-5.3 2.8-3-5.2-6 .2 1-5.9-4.8-3.5 4.1-4.3-2.3-5.5 5.6-2.2.5-6 5.8 1.4Z"
        fill="rgba(255,255,255,.18)"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="20"
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
