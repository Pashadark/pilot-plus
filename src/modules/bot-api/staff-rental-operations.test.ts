import { describe, expect, it, vi } from 'vitest';

import { listStaffOperationalRentals, requireStaffActor } from './staff-rental-operations';

const staff = {
  identityId: 'identity-1',
  telegramUserId: '185185047',
  kind: 'STAFF' as const,
  companyId: 'company-1',
  clientId: null,
  userId: 'user-1',
  displayName: 'Павел Седов',
};

describe('staff rental operation API domain', () => {
  it('requires a linked staff user and returns a company-scoped actor', () => {
    expect(requireStaffActor(staff)).toEqual({ id: 'user-1', scope: 'COMPANY' });
    expect(() =>
      requireStaffActor({ ...staff, kind: 'CLIENT', userId: null, clientId: 'client-1' }),
    ).toThrow('FORBIDDEN');
  });

  it('lists only confirmed or active rentals of the linked company', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'rental-1',
        contractNumber: 'ME-2026-0001-BK',
        status: 'ACTIVE',
        startsAt: new Date('2026-08-20T09:00:00.000Z'),
        endsAt: new Date('2026-08-21T09:00:00.000Z'),
        client: { firstName: 'Кристина', middleName: 'Олеговна', lastName: 'Барышева' },
        vehicle: { make: 'Kia', model: 'Ceed', registrationNumber: 'А429АУ997' },
      },
    ]);

    const result = await listStaffOperationalRentals(staff, { rental: { findMany } } as never);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', status: { in: ['CONFIRMED', 'ACTIVE'] } },
        take: 100,
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'rental-1',
        clientName: 'Барышева Кристина Олеговна',
        action: 'RETURN',
      }),
    );
  });
});
