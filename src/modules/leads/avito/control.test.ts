import { expect, it, vi } from 'vitest';
import { decodeControl, readAvitoControl, setAvitoControl } from './control';

it('defaults off and rejects malformed enable events', () => {
  expect(decodeControl(null).enabled).toBe(false);
  expect(decodeControl({ enabled: true, enabledAt: 'bad' }).enabled).toBe(false);
  expect(decodeControl({ enabled: 'true', enabledAt: '2026-09-24T12:00:00Z' }).enabled).toBe(false);
  expect(
    decodeControl({
      enabled: true,
      enabledAt: '2026-09-24T12:00:00Z',
      updatedAt: '2026-09-24T12:00:00Z',
    }).enabled,
  ).toBe(true);
});
it('reads only company-scoped control events', async () => {
  const auditLog = { findFirst: vi.fn().mockResolvedValue(null) };
  expect((await readAvitoControl('c', { auditLog } as never)).enabled).toBe(false);
  expect(auditLog.findFirst.mock.calls[0][0].where).toEqual({
    companyId: 'c',
    entityType: 'SYSTEM',
    entityId: 'avito-autoreply:c',
    action: 'UPDATE',
  });
});
function fixture(allowed = true) {
  const tx = {
    $executeRaw: vi.fn(),
    user: {
      findFirst: vi.fn().mockResolvedValue(allowed ? { id: 'u', email: 'owner@test' } : null),
    },
    telegramGroupBinding: { findFirst: vi.fn().mockResolvedValue({ companyId: 'c' }) },
    avitoDialogue: { findFirst: vi.fn().mockResolvedValue({ id: 'd' }) },
    auditLog: { create: vi.fn() },
    avitoOutgoing: { updateMany: vi.fn() },
  };
  return { tx, db: { $transaction: async (f: (t: typeof tx) => unknown) => f(tx) } as never };
}
it('rejects unauthorized changes before writing', async () => {
  const { tx, db } = fixture(false);
  await expect(setAvitoControl('u', 'c', true, db)).rejects.toThrow('FORBIDDEN');
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});
it('cancels pending replies and records a fresh enable cutoff', async () => {
  const { tx, db } = fixture();
  const result = await setAvitoControl('u', 'c', true, db);
  expect(result.enabled).toBe(true);
  expect(Number.isFinite(Date.parse(result.enabledAt!))).toBe(true);
  expect(tx.avitoOutgoing.updateMany).toHaveBeenCalledWith({
    where: { companyId: 'c', state: 'PENDING' },
    data: { state: 'CANCELLED', errorCode: 'OWNER_CONTROL_CHANGED' },
  });
  expect(tx.auditLog.create.mock.calls[0][0].data.actorUserId).toBe('u');
});

it('rejects a user who is not the bound company owner', async () => {
  const { tx, db } = fixture();
  tx.telegramGroupBinding.findFirst.mockResolvedValue(null);
  await expect(setAvitoControl('u', 'c', true, db)).rejects.toThrow('FORBIDDEN');
  expect(tx.auditLog.create).not.toHaveBeenCalled();
});

it('disabling removes the enable cutoff and cancels the queue', async () => {
  const { tx, db } = fixture();
  const state = await setAvitoControl('u', 'c', false, db);
  expect(state.enabled).toBe(false);
  expect(state.enabledAt).toBeNull();
  expect(tx.avitoOutgoing.updateMany).toHaveBeenCalledOnce();
});
