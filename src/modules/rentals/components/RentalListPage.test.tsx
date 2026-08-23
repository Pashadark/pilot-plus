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

  it('показывает операционную таблицу с цветными статусами, суммой и залогом', () => {
    render(
      <RentalListPage
        now="2026-08-23T12:00:00.000Z"
        rentals={[
          {
            id: 'active',
            startsAt: '2026-08-20T09:00:00.000Z',
            endsAt: '2026-08-24T09:00:00.000Z',
            status: 'ACTIVE',
            contractNumber: 'ME-2026-0014',
            totalPriceMinor: BigInt(2_500_000),
            depositMinor: BigInt(10_000_000),
            currency: 'RUB',
            vehicleLabel: 'Kia Rio · Р604АО997',
            clientLabel: 'Филатов Илья',
            hasExtension: true,
            documentFormats: ['DOCX', 'PDF'],
            documents: [
              { format: 'DOCX', version: 2 },
              { format: 'PDF', version: 2 },
            ],
          },
          {
            id: 'closed',
            startsAt: '2026-08-17T09:00:00.000Z',
            endsAt: '2026-08-18T09:00:00.000Z',
            status: 'COMPLETED',
            contractNumber: 'ME-2026-0011',
            totalPriceMinor: BigInt(940_000),
            depositMinor: BigInt(5_000_000),
            currency: 'RUB',
            vehicleLabel: 'Kia Rio · Р604АО997',
            clientLabel: 'Коломенцев Александр',
            hasExtension: false,
            documentFormats: [],
            documents: [],
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Новый договор' })).toBeTruthy();
    expect(screen.getAllByText('Продлён').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Закрыт').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/25.000.₽/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100.000.₽/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText('PDF').length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole('link', { name: 'Скачать Word ME-2026-0014' })
        .every((link) => link.getAttribute('href') === '/rentals/active/documents/2/DOCX'),
    ).toBe(true);
    expect(
      screen
        .getAllByRole('link', { name: 'Скачать PDF ME-2026-0014' })
        .every((link) => link.getAttribute('href') === '/rentals/active/documents/2/PDF'),
    ).toBe(true);
    expect(screen.getAllByText(/Окончание:/u).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Календарь' }).getAttribute('href')).toContain(
      'view=calendar',
    );
  });
});
