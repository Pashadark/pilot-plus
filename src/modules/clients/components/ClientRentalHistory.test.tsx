// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ClientRentalHistory } from './ClientRentalHistory';

afterEach(cleanup);

describe('ClientRentalHistory', () => {
  it('показывает аренду, машину и защищённые ссылки договоров', () => {
    render(
      <ClientRentalHistory
        workspace={{
          summary: { total: 1, active: 0, completed: 1, totalMinor: '250000' },
          rentals: [
            {
              id: 'rental-1',
              contractNumber: 'ME-2026-0001-BK',
              status: 'COMPLETED',
              startsAt: '2026-08-01T09:00:00.000Z',
              endsAt: '2026-08-03T09:00:00.000Z',
              billableDays: 2,
              totalPriceMinor: '250000',
              depositMinor: '100000',
              currency: 'RUB',
              vehicle: { label: "Kia Cee'd", registrationNumber: 'А123АА77' },
              documents: [
                { version: 1, format: 'DOCX' },
                { version: 1, format: 'PDF' },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('ME-2026-0001-BK')).toBeTruthy();
    expect(screen.getByText("Kia Cee'd")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Скачать PDF' }).getAttribute('href')).toBe(
      '/rentals/rental-1/documents/1/PDF',
    );
  });
});
