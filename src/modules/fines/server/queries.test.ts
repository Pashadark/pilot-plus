import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFineAccessMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const companyFindManyMock = vi.hoisted(() => vi.fn());
const rentalFindManyMock = vi.hoisted(() => vi.fn());
const vehicleFindManyMock = vi.hoisted(() => vi.fn());
const clientFindManyMock = vi.hoisted(() => vi.fn());
const fineCountMock = vi.hoisted(() => vi.fn());
const fineAggregateMock = vi.hoisted(() => vi.fn());
const tollLoadMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('./toll-queries', () => ({ loadTollDebts: tollLoadMock }));
vi.mock('../access', () => ({
  getFineAccess: getFineAccessMock,
  FineAccessDeniedError: class extends Error {},
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    fine: { findMany: findManyMock, count: fineCountMock, aggregate: fineAggregateMock },
    company: { findMany: companyFindManyMock },
    rental: { findMany: rentalFindManyMock },
    vehicle: { findMany: vehicleFindManyMock },
    client: { findMany: clientFindManyMock },
  },
}));

import { listFinesForCurrentUser } from './queries';

describe('fine queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tollLoadMock.mockResolvedValue({ items: [], unavailable: false });
    vehicleFindManyMock.mockResolvedValue([]);
    clientFindManyMock.mockResolvedValue([]);
    fineCountMock.mockResolvedValue(0);
    fineAggregateMock.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { currentAmountMinor: null },
    });
  });

  it('includes road debts in common pagination and totals, respects paid filter', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'DISPATCHER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'A' }]);
    findManyMock.mockResolvedValue([]);
    const items = Array.from({ length: 75 }, (_, i) => ({
      id: `toll:company-a:${i}`,
      companyId: 'company-a',
      kind: 'TOLL',
      roadLabel: 'МСД',
      status: 'UNPAID',
      offenseAt: '2026-09-22T09:00:00Z',
      currentAmountMinor: '10000',
      originalAmountMinor: '10000',
      assigned: false,
      vehicleLabel: 'Polo',
    }));
    tollLoadMock.mockResolvedValue({ items, unavailable: false });
    const first = await listFinesForCurrentUser({ status: 'UNPAID' });
    expect(first.fines).toHaveLength(50);
    expect(first.pagination.total).toBe(75);
    expect(first.summary.unpaidAmountMinor).toBe('750000');
    const second = await listFinesForCurrentUser({ status: 'UNPAID', page: '2' });
    expect(second.fines).toHaveLength(25);
    const paid = await listFinesForCurrentUser({ status: 'PAID' });
    expect(paid.fines).toHaveLength(0);
    expect(paid.summary.unpaidAmountMinor).toBe('0');
    expect(tollLoadMock).toHaveBeenCalledWith(['company-a']);
  });

  it('forces exact tenant IDs for company users', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'DISPATCHER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'Компания А' }]);
    findManyMock.mockResolvedValue([]);

    await expect(listFinesForCurrentUser({ status: 'UNPAID' })).resolves.toMatchObject({
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

  it('hides assignment candidates after a client and rental are confirmed', async () => {
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
      assignmentCandidates: [],
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

  it('aggregates the full filtered tenant result instead of the second page', async () => {
    getFineAccessMock.mockResolvedValue({
      scope: 'COMPANY',
      companyIds: ['company-a'],
      rolesByCompany: { 'company-a': 'COMPANY_ADMIN' },
      user: { role: 'MEMBER' },
    });
    companyFindManyMock.mockResolvedValue([{ id: 'company-a', name: 'Компания А' }]);
    findManyMock.mockResolvedValue([
      {
        id: 'fine-page-two',
        companyId: 'company-a',
        decreeNumber: '188101',
        offenseAt: new Date('2026-08-16T09:30:00.000Z'),
        currentAmountMinor: BigInt(10000),
        originalAmountMinor: BigInt(10000),
        status: 'UNPAID',
        description: null,
        address: null,
        comment: null,
        discountExpiresAt: null,
        toBailiff: false,
        photoState: null,
        vehicleId: 'vehicle-1',
        rentalId: null,
        clientId: null,
        assignmentSource: null,
        rental: null,
        vehicle: null,
        client: null,
      },
    ]);
    fineCountMock.mockImplementation(({ where }) => {
      if (!('AND' in where)) return 49;
      const [base, constraint] = where.AND as [{ companyId: string }, Record<string, unknown>];
      if (base.companyId !== 'company-a') return 0;
      if (constraint.status === 'NEW') return 4;
      if (constraint.toBailiff === true) return 2;
      if ('discountExpiresAt' in constraint) return 3;
      if ('OR' in constraint) return 5;
      return 0;
    });
    fineAggregateMock.mockResolvedValue({
      _count: { _all: 17 },
      _sum: { currentAmountMinor: BigInt(345600) },
    });

    const result = await listFinesForCurrentUser({
      companyId: 'company-a',
      page: '2',
      pageSize: '100',
    });

    expect(result.pagination).toEqual({ page: 1, pageSize: 100, total: 49, totalPages: 1 });
    expect(result.fines).toHaveLength(1);
    expect(result.summary).toEqual({
      newCount: 4,
      newAmountMinor: '345600',
      unpaidCount: 17,
      unpaidAmountMinor: '345600',
      unassignedCount: 5,
      unassignedAmountMinor: '345600',
      urgentCount: 17,
      urgentAmountMinor: '345600',
      tollCount: 0,
      tollAmountMinor: '0',
      discountEndingSoonCount: 3,
      bailiffRiskCount: 2,
    });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: { AND: [{ companyId: 'company-a' }, { id: { in: ['fine-page-two'] } }] },
      }),
    );
    expect(fineAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _count: { _all: true },
        _sum: { currentAmountMinor: true },
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });
});
