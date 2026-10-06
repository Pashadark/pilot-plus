// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NewRentalClientPicker } from './NewRentalClientPicker';

describe('NewRentalClientPicker', () => {
  afterEach(cleanup);

  it('starts a rental for the selected client and keeps client creation available', () => {
    render(
      <NewRentalClientPicker
        query=""
        clients={[
          {
            id: 'client-1',
            fullName: 'Иванов Иван Иванович',
            phone: '+7 999 000-00-00',
            status: 'ACTIVE',
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /выбрать и продолжить/i }).getAttribute('href')).toBe(
      '/clients/client-1/rentals/new',
    );
    expect(screen.getByRole('link', { name: /создать нового клиента/i }).getAttribute('href')).toBe(
      '/clients?form=new',
    );
  });

  it('shows the verified client status in Russian', () => {
    render(
      <NewRentalClientPicker
        query=""
        clients={[
          {
            id: 'client-verified',
            fullName: 'Петров Пётр Петрович',
            phone: '+7 999 111-11-11',
            status: 'VERIFIED',
          },
        ]}
      />,
    );

    expect(screen.getByText('Проверен')).toBeTruthy();
    expect(screen.queryByText('VERIFIED')).toBeNull();
  });

  it.each([
    ['DRAFT', 'Черновик'],
    ['NEW', 'Новый'],
    ['ARCHIVED', 'В архиве'],
  ])('shows %s as %s', (status, expectedLabel) => {
    render(
      <NewRentalClientPicker
        query=""
        clients={[
          {
            id: `client-${status.toLowerCase()}`,
            fullName: 'Тестов Тест Тестович',
            phone: '+7 999 222-22-22',
            status,
          },
        ]}
      />,
    );

    expect(screen.getByText(expectedLabel)).toBeTruthy();
    expect(screen.queryByText(status)).toBeNull();
  });
});
