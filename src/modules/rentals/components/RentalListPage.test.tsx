// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RentalListPage } from './RentalListPage';

afterEach(cleanup);

describe('RentalListPage', () => {
  it('сохраняет серверные фильтры и объясняет доступный поиск', () => {
    render(
      <RentalListPage
        rentals={[]}
        filters={{ query: 'Иванов', status: 'COMPLETED', from: '2026-08-01', to: '2026-08-31' }}
      />,
    );
    expect(screen.getByLabelText('Поиск клиента или автомобиля').getAttribute('value')).toBe(
      'Иванов',
    );
    expect(screen.getByPlaceholderText('Фамилия, договор, машина или госномер')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Сбросить фильтры' })).toBeTruthy();
  });
});
