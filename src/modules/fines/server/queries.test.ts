import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFineAccessMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const companyFindManyMock = vi.hoisted(() => vi.fn());
const rentalFindManyMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../access', () => ({
  getFineAccess: getFineAccessMock,
  FineAccessDeniedError: class extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fine: { findMany: findManyMock },
    company: { findMany: companyFindManyMock },
    rental: { findMany: rentalFindManyMock },
  },
}));

import { listFinesForCurrentUser } from './queries';

describe('fine queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forces exact tenant IDs for company users', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'DISPATCHER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'Компания А' }]);
    findManyMock.mockResolvedValue([]);

    await expect(listFinesForCurrentUser({ status: 'UNPAID' })).resolves.toEqual({
      companies: [{ id: 'company-a', name: 'Компания А' }],
      selectedCompanyId: 'company-a',
      canSync: true,
      fines: [],
      summary: { newCount: 0, unpaidCount: 0, unpaidAmountMinor: '0', unassignedCount: 0 },
    });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a', status: 'UNPAID' }),
      }),
    );
  });

  it('returns safe, sorted assignment candidates and the current assignment source', async () => {
    const offenseAt = new Date('2026-08-16T09:30:00.000Z');
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'DISPATCHER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'Компания А' }]);
    findManyMock.mockResolvedValue([
      {
        id: 'fine-1',
        companyId: 'company-a',
        decreeNumber: '188101',
        offenseAt,
        currentAmountMinor: BigInt(250000),
        originalAmountMinor: BigInt(500000),
        status: 'UNPAID',
        description: null,
        address: null,
        photoState: null,
        vehicleId: 'vehicle-1',
        rentalId: 'rental-current',
        clientId: 'client-current',
        assignmentSource: 'MANUAL',
        vehicle: {
          make: 'Toyota',
          modelName: 'Camry',
          model: 'Camry',
          registrationNumber: 'А001АА24',
        },
        client: { firstName: 'Анна', middleName: 'Игоревна', lastName: 'Иванова' },
      },
    ]);
    rentalFindManyMock.mockResolvedValue([
      {
        id: 'rental-before',
        companyId: 'company-a',
        vehicleId: 'vehicle-1',
        clientId: 'client-before',
        contractNumber: 'ME-2026-0001-AA',
        startsAt: new Date('2026-08-16T07:00:00.000Z'),
        endsAt: new Date('2026-08-16T09:00:00.000Z'),
        client: { firstName: 'Борис', middleName: null, lastName: 'Белов' },
      },
      {
        id: 'rental-after',
        companyId: 'company-a',
        vehicleId: 'vehicle-1',
        clientId: 'client-after',
        contractNumber: 'ME-2026-0002-BB',
        startsAt: new Date('2026-08-16T09:45:00.000Z'),
        endsAt: new Date('2026-08-16T11:00:00.000Z'),
        client: { firstName: 'Вера', middleName: 'Олеговна', lastName: 'Волкова' },
      },
    ]);

    const result = await listFinesForCurrentUser({ companyId: 'company-a' });

    expect(result.fines[0]).toMatchObject({
      id: 'fine-1',
      assignedRentalId: 'rental-current',
      assignmentSource: 'MANUAL',
      assignmentCandidates: [
        {
          rentalId: 'rental-after',
          contractNumber: 'ME-2026-0002-BB',
          clientDisplayName: 'Волкова Вера Олеговна',
          startsAt: '2026-08-16T09:45:00.000Z',
          endsAt: '2026-08-16T11:00:00.000Z',
          distanceMs: 15 * 60 * 1000,
          distanceLabel: '15 мин после',
          relativeToOffense: 'AFTER',
        },
        {
          rentalId: 'rental-before',
          contractNumber: 'ME-2026-0001-AA',
          clientDisplayName: 'Белов Борис',
          startsAt: '2026-08-16T07:00:00.000Z',
          endsAt: '2026-08-16T09:00:00.000Z',
          distanceMs: 30 * 60 * 1000,
          distanceLabel: '30 мин до',
          relativeToOffense: 'BEFORE',
        },
      ],
    });
    expect(rentalFindManyMock).toHaveBeenCalledWith({
      where: {
        companyId: { in: ['company-a'] },
        OR: [
          {
            companyId: 'company-a',
            vehicleId: 'vehicle-1',
            startsAt: { lte: new Date('2026-08-19T09:30:00.000Z') },
            endsAt: { gte: new Date('2026-08-13T09:30:00.000Z') },
          },
        ],
      },
      select: {
        id: true,
        companyId: true,
        vehicleId: true,
        clientId: true,
        contractNumber: true,
        startsAt: true,
        endsAt: true,
        client: { select: { firstName: true, middleName: true, lastName: true } },
      },
    });
    expect(JSON.stringify(rentalFindManyMock.mock.calls[0]?.[0])).not.toMatch(
      /Encrypted|passport|phone|license/i,
    );
  });

  it('uses an explicit company whitelist for system-wide reads', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'SYSTEM',
      companyIds: [],
      rolesByCompany: {},
    });
    companyFindManyMock.mockResolvedValue([
      { id: 'company-a', name: 'Компания А' },
      { id: 'company-b', name: 'Компания Б' },
    ]);
    findManyMock.mockResolvedValue([]);

    await listFinesForCurrentUser({});

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: { in: ['company-a', 'company-b'] } }),
      }),
    );
  });
});
