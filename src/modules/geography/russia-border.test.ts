import { describe, expect, it } from 'vitest';

import { findRussiaBorderProximity } from './russia-border';

describe('границы России', () => {
  it('находит Финляндию рядом с российско-финской границей', () => {
    const result = findRussiaBorderProximity(60.9, 28.9, 100);

    expect(result?.countryCode).toBe('FI');
    expect(result?.distanceKm).toBeLessThan(100);
  });

  it('не создаёт событие далеко от сопредельных границ', () => {
    expect(findRussiaBorderProximity(55.7558, 37.6176, 100)).toBeNull();
  });
});
