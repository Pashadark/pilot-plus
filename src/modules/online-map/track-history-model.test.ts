import { expect, it } from 'vitest';

import type { OnlineMapTrackHistoryDto } from './track-types';
import { attachFinesToTracks } from './track-history-model';

const history: OnlineMapTrackHistoryDto = {
  vehicleId: 'vehicle-1',
  from: '2026-09-15',
  to: '2026-09-15',
  availableDates: ['2026-09-15'],
  tracks: [
    {
      vehicleId: 'vehicle-1',
      date: '2026-09-15',
      points: [
        { id: 'p1', coordinates: [37.6, 55.7], timestamp: '10:00', speedKph: 50, address: 'Москва' },
        { id: 'p2', coordinates: [37.7, 55.8], timestamp: '10:10', speedKph: 80, address: 'Москва' },
      ],
      events: [],
    },
  ],
  fines: [
    {
      id: 'fine-exact',
      decreeNumber: 'exact',
      offenseAt: '2026-09-15T07:05:00.000Z',
      coordinates: [37.65, 55.75],
      pointId: null,
      locationSource: 'exact',
      amountMinor: 500_000,
      status: 'NEW',
      description: 'Превышение скорости',
      address: 'Москва',
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0044-AA',
      clientId: 'client-1',
      clientName: 'Иванов Иван',
    },
    {
      id: 'fine-unmapped',
      decreeNumber: 'unmapped',
      offenseAt: '2026-09-15T09:00:00.000Z',
      coordinates: null,
      pointId: null,
      locationSource: 'unmapped',
      amountMinor: 100_000,
      status: 'NEW',
      description: null,
      address: null,
      rentalId: null,
      contractNumber: null,
      clientId: null,
      clientName: null,
    },
  ],
};

it('добавляет на маршрут только штраф с достоверной или вычисленной точкой', () => {
  const tracks = attachFinesToTracks(history);

  expect(tracks[0].events).toHaveLength(1);
  expect(tracks[0].events[0]).toEqual(
    expect.objectContaining({
      id: 'fine-fine-exact',
      type: 'fine',
      coordinates: [37.65, 55.75],
      timestamp: '10:05',
      fine: history.fines[0],
    }),
  );
});
