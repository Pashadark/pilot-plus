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
      className="flex items-center gap-1.5 text-sm"
    >
      <span aria-hidden="true" className="flex text-amber-500">
        {Array.from({ length: 5 }, (_, index) => (
          <FiStar
            key={index}
            data-testid="rating-star"
            className={`size-3.5 ${index < rating.stars ? 'fill-current' : 'opacity-30'}`}
          />
        ))}
      </span>
      <span className="tabular-nums text-[var(--color-text-secondary)]">{rating.display}</span>
      {compact ? null : <span className="text-[var(--color-text-secondary)]">{rating.label}</span>}
    </div>
  );
}
