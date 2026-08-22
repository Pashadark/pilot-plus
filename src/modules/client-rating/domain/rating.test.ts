import { describe, expect, it } from 'vitest';

import { calculateClientRating, ratingLabel, scoreToStars } from './rating';
import { CLIENT_RATING_REASONS, isClientRatingReason } from '../types';

describe('рейтинг надёжности клиента', () => {
  it('starts a new client at 55 points and three stars while the rating forms', () => {
    expect(calculateClientRating([], 0)).toMatchObject({
      score: 55,
      stars: 3,
      display: '2,8',
      label: 'Рейтинг формируется',
      completedRentals: 0,
      eventCount: 0,
    });
  });

  it('clamps the summed ledger score at both ends', () => {
    expect(calculateClientRating([{ delta: 50 }], 2).score).toBe(100);
    expect(calculateClientRating([{ delta: -80 }], 1).score).toBe(0);
  });

  it('maps every persisted score band to the documented number of stars', () => {
    expect(scoreToStars(0)).toBe(1);
    expect(scoreToStars(29)).toBe(1);
    expect(scoreToStars(30)).toBe(2);
    expect(scoreToStars(55)).toBe(3);
    expect(scoreToStars(75)).toBe(4);
    expect(scoreToStars(90)).toBe(5);
    expect(scoreToStars(100)).toBe(5);
  });

  it('uses the forming label only until the first completed rental', () => {
    expect(ratingLabel(55, 0)).toBe('Рейтинг формируется');
    expect(ratingLabel(84, 1)).toBe('Надёжный клиент');
  });

  it('allows only stable machine reason codes for immutable ledger events', () => {
    expect(CLIENT_RATING_REASONS).toContain('MANUAL_COMMENT');
    expect(isClientRatingReason('CLEAN_RENTAL_COMPLETED')).toBe(true);
    expect(isClientRatingReason('Клиент сообщил номер паспорта 1234')).toBe(false);
  });
});
