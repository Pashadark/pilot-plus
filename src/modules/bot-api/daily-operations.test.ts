import { describe, expect, it, vi } from 'vitest';

import { listDailyOperations, moscowDayRange } from './daily-operations';

const identity = {
  identityId: 'i1',
  telegramUserId: '1',
  kind: 'STAFF' as const,
  companyId: 'c1',
  clientId: null,
  userId: 'u1',
  displayName: 'Павел',
};

describe('daily operations', () => {
  it('builds an exact Moscow calendar day in UTC', () => {
    expect(moscowDayRange('2026-08-20')).toEqual({
      date: '2026-08-20',
      start: new Date('2026-08-19T21:00:00.000Z'),
      end: new Date('2026-08-20T21:00:00.000Z'),
    });
    expect(() => moscowDayRange('2026-02-30')).toThrow();
  });

  it('returns tenant requests, schedule, returns and only genuinely free vehicles', async () => {
    const db = {
      telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ user: { role: 'MEMBER' } }) },
      companyMember: { findFirst: vi.fn().mockResolvedValue({ role: 'DISPATCHER' }) },
      botRentalRequest: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'q1',
              startsAt: new Date('2026-08-20T08:00:00Z'),
              endsAt: new Date('2026-08-20T10:00:00Z'),
              fulfillmentMode: 'DELIVERY',
              client: { firstName: 'Иван', lastName: 'Иванов' },
              preferredVehicle: null,
            },
          ]),
      },
      rental: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'r1',
              contractNumber: 'ME-1',
              startsAt: new Date('2026-08-19T22:00:00Z'),
              endsAt: new Date('2026-08-20T09:00:00Z'),
              client: { firstName: 'Павел', lastName: 'Седов' },
              vehicle: { make: 'Kia', modelName: 'K5', model: 'K5', registrationNumber: 'А001АА' },
            },
          ]),
      },
      vehicle: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'v1',
            make: 'Kia',
            modelName: 'K5',
            model: 'K5',
            registrationNumber: 'А001АА',
            status: 'IDLE',
            rentals: [],
            maintenanceRecords: [],
          },
          {
            id: 'v2',
            make: 'Kia',
            modelName: 'Ceed',
            model: 'Ceed',
            registrationNumber: 'А002АА',
            status: 'IDLE',
            rentals: [{ id: 'r2' }],
            maintenanceRecords: [],
          },
        ]),
      },
    };
    const result = await listDailyOperations(identity, '2026-08-20', db as never);
    expect(result.requests).toHaveLength(1);
    expect(result.rentals).toHaveLength(1);
    expect(result.returns).toHaveLength(1);
    expect(result.freeVehicles.map((vehicle) => vehicle.id)).toEqual(['v1']);
    expect(db.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'c1', archivedAt: null },
      }),
    );
  });
});
