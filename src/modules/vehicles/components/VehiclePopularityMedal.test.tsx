// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { VehiclePopularityMedal } from './VehiclePopularityMedal';

afterEach(cleanup);

describe('VehiclePopularityMedal', () => {
  it.each([
    [1, 'Золото'],
    [2, 'Серебро'],
    [3, 'Бронза'],
  ] as const)('показывает SVG для места %s с подписью %s', (rank, tone) => {
    render(<VehiclePopularityMedal rank={rank} />);

    const medal = screen.getByRole('img', { name: `${rank} место по количеству заказов` });
    expect(medal.tagName.toLowerCase()).toBe('svg');
    expect(medal.textContent).toContain(String(rank));
    expect(medal.getAttribute('data-medal-tone')).toBe(tone);
    expect(medal.getAttribute('data-medal-style')).toBe('premium-rosette-ribbon');
    expect(medal.getAttribute('class')).toContain('size-9');
    expect(medal.querySelectorAll('radialGradient')).toHaveLength(2);
    expect(medal.querySelectorAll('[data-medal-ribbon]')).toHaveLength(2);
    expect(medal.querySelector('[data-medal-scalloped-edge]')).toBeTruthy();
  });
});
