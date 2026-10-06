import { expect, it } from 'vitest';
import { matchRentalFleet } from './fleet-match';
import { extractRentalRequest } from './rental-request';
const now = new Date('2026-09-24T09:00:00Z');
const request = extractRentalRequest('Камри с 25.09.2026 14:00 по 28.09.2026 14:00', now);
const vehicle = {
  id: 'car',
  model: 'Toyota Camry',
  registrationNumber: 'А123АА777',
  isRentalReady: true,
  status: 'PARKED',
  rentals: [],
  maintenanceRecords: [],
};
it('does not claim availability without complete dates', () => {
  expect(matchRentalFleet([vehicle], { ...request, startsAt: null }).available).toEqual([]);
});
it('matches the requested model and rejects a different model', () => {
  expect(
    matchRentalFleet(
      [vehicle, { ...vehicle, id: 'polo', model: 'Volkswagen Polo' }],
      request,
    ).available.map((c) => c.id),
  ).toEqual(['car']);
});
it('excludes overlapping rentals but permits end/start boundary', () => {
  const occupied = {
    ...vehicle,
    rentals: [
      {
        startsAt: new Date('2026-09-25T10:00:00Z'),
        endsAt: new Date('2026-09-26T10:00:00Z'),
        status: 'ACTIVE',
      },
    ],
  };
  expect(matchRentalFleet([occupied], request).available).toEqual([]);
  expect(
    matchRentalFleet(
      [{ ...occupied, rentals: [{ ...occupied.rentals[0], endsAt: new Date(request.startsAt!) }] }],
      request,
    ).available,
  ).toHaveLength(1);
});
it('excludes unready vehicles and open maintenance without a known end', () => {
  expect(matchRentalFleet([{ ...vehicle, isRentalReady: false }], request).available).toEqual([]);
  expect(
    matchRentalFleet(
      [
        {
          ...vehicle,
          maintenanceRecords: [{ status: 'IN_PROGRESS', scheduledAt: null, scheduledEndsAt: null }],
        },
      ],
      request,
    ).available,
  ).toEqual([]);
});
it('blocks planned maintenance overlap and ignores completed maintenance', () => {
  const maintenance = {
    status: 'PLANNED',
    scheduledAt: new Date(request.startsAt!),
    scheduledEndsAt: new Date(request.endsAt!),
  };
  expect(
    matchRentalFleet([{ ...vehicle, maintenanceRecords: [maintenance] }], request).available,
  ).toEqual([]);
  expect(
    matchRentalFleet(
      [{ ...vehicle, maintenanceRecords: [{ ...maintenance, status: 'COMPLETED' }] }],
      request,
    ).available,
  ).toHaveLength(1);
});
