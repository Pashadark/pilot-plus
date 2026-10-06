import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  vehicle: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('@/services/auth/session', () => ({ readSession: mocks.session }));
vi.mock('@/modules/vehicles/manage/access', () => ({
  requireVehicleManagementAccess: mocks.access,
}));
vi.mock('@/database/prisma/client', () => ({
  prisma: { vehicle: { findFirst: mocks.vehicle }, $transaction: mocks.transaction },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { saveServicePlan } from './service-plan-actions';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ id: 'u', role: 'SUPER_ADMIN', email: 'a@b.ru' });
});
it('rejects a missing session without writing', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await saveServicePlan('v', new FormData())).ok).toBe(false);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it('rejects invalid interval without writing', async () => {
  const form = new FormData();
  form.set('last', '100');
  form.set('next', '50');
  expect((await saveServicePlan('v', form)).ok).toBe(false);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it('rejects unauthorized management', async () => {
  const form = new FormData();
  form.set('last', '100');
  form.set('next', '500');
  mocks.vehicle.mockResolvedValue({ id: 'v', companyId: 'c' });
  mocks.access.mockRejectedValue(new Error('Forbidden'));
  expect((await saveServicePlan('v', form)).ok).toBe(false);
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it('saves interval and audit atomically without completing maintenance', async () => {
  mocks.access.mockResolvedValue({});
  mocks.vehicle.mockResolvedValue({ id: 'v', companyId: 'c', model: 'Polo' });
  const tx = { maintenanceRecord: { count: vi.fn().mockResolvedValue(0), create: vi.fn() }, auditLog: { create: vi.fn() } };
  mocks.transaction.mockImplementation(async callback => callback(tx));
  const form = new FormData(); form.set('last', '90000'); form.set('next', '100000'); form.set('date', '2026-10-01');
  expect((await saveServicePlan('v', form)).ok).toBe(true);
  expect(tx.maintenanceRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ vehicleId: 'v', odometerKm: 90000, targetOdometerKm: 100000, status: 'PLANNED' }) });
  expect(tx.auditLog.create).toHaveBeenCalledOnce();
});

it('rejects a stale version and does not write audit', async () => {
  mocks.access.mockResolvedValue({});
  mocks.vehicle.mockResolvedValue({ id: 'v', companyId: 'c', model: 'Polo' });
  const tx = { maintenanceRecord: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, auditLog: { create: vi.fn() } };
  mocks.transaction.mockImplementation(async callback => callback(tx));
  const form = new FormData(); form.set('last', '90000'); form.set('next', '100000'); form.set('recordId', 'r'); form.set('version', '2026-09-21T00:00:00.000Z');
  expect((await saveServicePlan('v', form)).ok).toBe(false);
  expect(tx.maintenanceRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'r', vehicleId: 'v', updatedAt: new Date('2026-09-21T00:00:00.000Z') }) }));
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});
