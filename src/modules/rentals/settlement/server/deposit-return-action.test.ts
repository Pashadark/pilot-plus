import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/database/prisma/client', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/modules/rentals/server/access', () => ({
  requireRentalAccess: async () => ({ user: { id: 'u', email: 'u@example.test', name: 'Оператор' } }),
  RentalAccessDeniedError: class extends Error {},
}));
import { returnRentalDepositAction } from './actions';
it('records deposit return without photos with amounts, reason, time and audit', async () => {
  const create = vi.fn(async ({ data }) => {
    if (data.evidenceStatus !== 'COMPLETE' && !data.evidenceMissingReason) throw new Error('Invalid `prisma. evidence_reason_check');
    return { id: 'operation-1' };
  });
  const tx = {
    rental: { findFirst: vi.fn().mockResolvedValue({ id: 'r', clientId: 'c', vehicleId: 'v', payments: [{ amountMinor: BigInt(2000000) }], operations: [] }) },
    rentalOperation: { create }, auditLog: { create: vi.fn() },
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  mocks.transaction.mockImplementation(async work => work(tx));
  const form = new FormData();
  form.set('companyId', 'co'); form.set('rentalId', 'r');
  form.set('returnedRubles', '13880'); form.set('reason', 'Бензин, штраф');
  expect(await returnRentalDepositAction(null, form)).toMatchObject({ ok: true });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
    type: 'DEPOSIT_RETURN', depositAmountMinor: BigInt(2000000), depositWithheldMinor: BigInt(612000),
    depositResolutionReason: 'Бензин, штраф', occurredAt: expect.any(Date), actorUserId: 'u',
  }) }));
  expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ changes: expect.objectContaining({ returnedMinor: '1388000', reason: 'Бензин, штраф' }) }) }));
});
