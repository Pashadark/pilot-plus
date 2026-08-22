import type { ClientRatingEventDelta, ClientRatingSummary } from '../types';

const BASE_SCORE = 55;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
}

export function scoreToStars(score: number): number {
  const clampedScore = clampScore(score);
  if (clampedScore >= 90) return 5;
  if (clampedScore >= 75) return 4;
  if (clampedScore >= 55) return 3;
  if (clampedScore >= 30) return 2;
  return 1;
}

export function ratingLabel(score: number, completedRentals: number): string {
  if (completedRentals === 0) return 'Рейтинг формируется';
  if (score >= 90) return 'Отличная надёжность';
  if (score >= 75) return 'Надёжный клиент';
  if (score >= 55) return 'Стабильный клиент';
  if (score >= 30) return 'Требует внимания';
  return 'Высокий риск';
}

export function calculateClientRating(
  events: ReadonlyArray<ClientRatingEventDelta>,
  completedRentals: number,
): ClientRatingSummary {
  const score = clampScore(BASE_SCORE + events.reduce((total, event) => total + event.delta, 0));

  return {
    score,
    stars: scoreToStars(score),
    display: (score / 20).toFixed(1).replace('.', ','),
    label: ratingLabel(score, completedRentals),
    completedRentals,
    eventCount: events.length,
  };
}
