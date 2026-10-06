type PopularityRank = 1 | 2 | 3;

const medalPalette = {
  1: { tone: 'Золото', light: '#FFF6B8', main: '#F5C33B', rich: '#D89408', dark: '#815000' },
  2: { tone: 'Серебро', light: '#FFFFFF', main: '#D9E0E8', rich: '#9BA8B7', dark: '#566270' },
  3: { tone: 'Бронза', light: '#FFE0BD', main: '#D99455', rich: '#A95C26', dark: '#693211' },
} as const;

export function VehiclePopularityMedal({ rank }: { rank: PopularityRank }) {
  const palette = medalPalette[rank];
  const rimGradientId = `vehicle-popularity-rim-${rank}`;
  const faceGradientId = `vehicle-popularity-face-${rank}`;
  const ribbonGradientId = `vehicle-popularity-ribbon-${rank}`;

  return (
    <svg
      role="img"
      aria-label={`${rank} место по количеству заказов`}
      data-medal-tone={palette.tone}
      data-medal-style="premium-rosette-ribbon"
      viewBox="0 0 48 56"
      className="size-9 overflow-visible drop-shadow-[0_2px_5px_rgba(15,23,42,0.25)] sm:size-10"
    >
      <title>{`${rank} место по количеству заказов`}</title>
      <defs>
        <radialGradient id={rimGradientId} cx="35%" cy="24%" r="72%">
          <stop stopColor={palette.light} />
          <stop offset="0.42" stopColor={palette.main} />
          <stop offset="0.76" stopColor={palette.rich} />
          <stop offset="1" stopColor={palette.dark} />
        </radialGradient>
        <radialGradient id={faceGradientId} cx="37%" cy="28%" r="70%">
          <stop stopColor={palette.light} />
          <stop offset="0.52" stopColor={palette.main} />
          <stop offset="0.82" stopColor={palette.rich} />
          <stop offset="1" stopColor={palette.dark} />
        </radialGradient>
        <linearGradient id={ribbonGradientId} x1="12" y1="32" x2="36" y2="54">
          <stop stopColor={palette.light} />
          <stop offset="0.38" stopColor={palette.main} />
          <stop offset="0.72" stopColor={palette.rich} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
      </defs>
      <path
        data-medal-ribbon="left"
        d="M12.2 31.5h11.3v17.2l-6.1-3.8-6.2 7.2Z"
        fill={`url(#${ribbonGradientId})`}
        stroke={palette.dark}
        strokeWidth=".8"
      />
      <path
        data-medal-ribbon="right"
        d="M24.5 31.5h11.3l1 20.6-6.2-7.2-6.1 3.8Z"
        fill={`url(#${ribbonGradientId})`}
        stroke={palette.dark}
        strokeWidth=".8"
      />
      <path
        data-medal-scalloped-edge="true"
        d="m24 3 3 2.2 3.7-.9 2.2 3.1 3.8.3.7 3.7 3.4 1.7-.9 3.7 2.2 3-2.2 3 .9 3.7-3.4 1.7-.7 3.7-3.8.3-2.2 3.1-3.7-.9-3 2.2-3-2.2-3.7.9-2.2-3.1-3.8-.3-.7-3.7-3.4-1.7.9-3.7-2.2-3 2.2-3-.9-3.7 3.4-1.7.7-3.7 3.8-.3 2.2-3.1 3.7.9Z"
        fill={`url(#${rimGradientId})`}
        stroke={palette.dark}
        strokeWidth=".75"
      />
      <circle
        cx="24"
        cy="22"
        r="15.6"
        fill="none"
        stroke={palette.light}
        strokeWidth="1.1"
        opacity=".72"
      />
      <circle
        cx="24"
        cy="22"
        r="13.9"
        fill={`url(#${faceGradientId})`}
        stroke={palette.dark}
        strokeWidth="1.25"
      />
      <circle
        cx="24"
        cy="22"
        r="11.3"
        fill="none"
        stroke={palette.light}
        strokeWidth="1"
        opacity=".78"
      />
      <path
        d="M16 17.5a10 10 0 0 1 13.7-5.1"
        fill="none"
        stroke="#fff"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity=".58"
      />
      <text
        x="24"
        y="28.2"
        textAnchor="middle"
        fontSize="18"
        fontWeight="900"
        fill="#3A2604"
        stroke={palette.light}
        strokeWidth="0.9"
        paintOrder="stroke"
      >
        {rank}
      </text>
    </svg>
  );
}
