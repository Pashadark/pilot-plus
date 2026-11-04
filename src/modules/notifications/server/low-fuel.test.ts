import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  member: vi.fn(),
  vehicles: vi.fn(),
  position: vi.fn(),
  operation: vi.fn(),
  receipts: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/services/auth/session', () => ({ getAuthenticatedSession: mocks.session }));
vi.mock('@/database/prisma/client', () => ({
  prisma: {
    companyMember: { findFirst: mocks.member },
    vehicle: { findMany: mocks.vehicles },
    vehiclePosition: { findFirst: mocks.position },
    rentalOperation: { findFirst: mocks.operation },
    eventReadReceipt: { findMany: mocks.receipts, upsert: mocks.upsert },
  },
}));
import { listLowFuelNotifications, markLowFuelNotificationsRead } from './low-fuel';

const now = new Date('2026-10-09T12:00:00Z');
const observedAt = new Date('2026-10-09T11:00:00Z');
function vehicle(fuel = 24) {
  return {
    id: 'v1',
    companyId: 'c1',
    make: 'Kia',
    model: 'K5',
    registrationNumber: 'А001АА',
    positions: [{ id: 'p1', recordedAt: observedAt, fuelLevelPercent: fuel }],
    rentalOperations: [],
  };
}

describe('low fuel bell episodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ user: { id: 'u1' } });
    mocks.member.mockResolvedValue({ companyId: 'c1' });
    mocks.vehicles.mockResolvedValue([vehicle()]);
    mocks.position.mockResolvedValue(null);
    mocks.operation.mockResolvedValue(null);
    mocks.receipts.mockResolvedValue([]);
  });

  it('shows a fresh low reading with stable parser-compatible key and tenant scope', async () => {
    const result = await listLowFuelNotifications(now);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'FLEET',
      title: 'Мало топлива',
      href: '/vehicles/v1',
      isRead: false,
      occurredAt: observedAt.toISOString(),
    });
    expect(result[0].id).toMatch(/^low-fuel:[a-f0-9]{64}$/);
    expect(mocks.vehicles).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'c1', archivedAt: null, isDemoImport: false },
      }),
    );
    mocks.vehicles.mockResolvedValue([
      { ...vehicle(23), positions: [{ id: 'p2', recordedAt: now, fuelLevelPercent: 23 }] },
    ]);
    expect((await listLowFuelNotifications(now))[0].id).toBe(result[0].id);
  });

  it.each([25, 30, Number.NaN, -1, 101])(
    'does not alert for invalid or non-low fuel %s',
    async (fuel) => {
      mocks.vehicles.mockResolvedValue([vehicle(fuel)]);
      expect(await listLowFuelNotifications(now)).toEqual([]);
      expect(mocks.position).not.toHaveBeenCalled();
    },
  );

  it('rejects old signals but uses a newer committed operation', async () => {
    const old = {
      ...vehicle(),
      positions: [{ id: 'old', recordedAt: new Date('2026-10-07T00:00:00Z'), fuelLevelPercent: 3 }],
    };
    mocks.vehicles.mockResolvedValue([old]);
    expect(await listLowFuelNotifications(now)).toEqual([]);
    mocks.vehicles.mockResolvedValue([
      { ...old, rentalOperations: [{ id: 'op1', occurredAt: observedAt, fuelLevelPercent: 20 }] },
    ]);
    expect(await listLowFuelNotifications(now)).toHaveLength(1);
  });

  it('starts a new episode at the latest recovery from either source and restores read state', async () => {
    const initial = (await listLowFuelNotifications(now))[0];
    mocks.position.mockResolvedValue({
      id: 'recovery-p',
      recordedAt: new Date('2026-10-09T08:00:00Z'),
    });
    mocks.operation.mockResolvedValue({
      id: 'recovery-op',
      occurredAt: new Date('2026-10-09T09:00:00Z'),
    });
    const recovered = (await listLowFuelNotifications(now))[0];
    expect(recovered.id).not.toBe(initial.id);
    mocks.receipts.mockResolvedValue([{ eventKey: recovered.id }]);
    expect((await listLowFuelNotifications(now))[0].isRead).toBe(true);
    expect(mocks.operation).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'c1',
          status: 'COMMITTED',
          fuelLevelPercent: { gte: 30, lte: 100 },
        }),
      }),
    );
  });

  it('writes a receipt only for an authorized current episode', async () => {
    const key = (await listLowFuelNotifications(now))[0].id;
    expect(await markLowFuelNotificationsRead([key], now)).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { companyId: 'c1', userId: 'u1', eventKey: key } }),
    );
    mocks.upsert.mockClear();
    expect(await markLowFuelNotificationsRead(['low-fuel:foreign'], now)).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('does not read or write fuel data without membership', async () => {
    mocks.member.mockResolvedValue(null);
    expect(await listLowFuelNotifications(now)).toEqual([]);
    expect(await markLowFuelNotificationsRead(['low-fuel:foreign'], now)).toBe(false);
    expect(mocks.vehicles).not.toHaveBeenCalled();
  });
});
