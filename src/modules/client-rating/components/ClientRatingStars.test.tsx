// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClientRatingStars } from './ClientRatingStars';

describe('ClientRatingStars', () => {
  it('renders five accessible stars with a numeric fallback', () => {
    render(<ClientRatingStars rating={{ stars: 4, display: '4,2', label: 'Надёжный клиент' }} />);

    expect(screen.getByLabelText('Рейтинг клиента: 4,2 из 5')).toBeTruthy();
    expect(screen.getAllByTestId('rating-star')).toHaveLength(5);
    expect(screen.getByText('Надёжный клиент')).toBeTruthy();
  });
});
