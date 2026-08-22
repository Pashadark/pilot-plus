import { FiStar } from 'react-icons/fi';

import type { ClientRatingSummary } from '../types';

export function ClientRatingStars({
  rating,
  compact = false,
}: {
  rating: Pick<ClientRatingSummary, 'stars' | 'display' | 'label'>;
  compact?: boolean;
}) {
  return (
    <div
      aria-label={`Рейтинг клиента: ${rating.display} из 5`}
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <span aria-hidden="true" className="flex text-amber-500">
        {Array.from({ length: 5 }, (_, index) => (
          <FiStar
            key={index}
            data-testid="rating-star"
            className={index < rating.stars ? 'fill-current' : 'opacity-30'}
          />
        ))}
      </span>
      <strong className="tabular-nums">{rating.display}</strong>
      {compact ? null : <span className="text-[var(--color-text-secondary)]">{rating.label}</span>}
    </div>
  );
}
