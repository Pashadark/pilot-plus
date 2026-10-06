import { expect, it, vi } from 'vitest';
import { enqueueRentalLifecycleNotifications } from './enqueue-lifecycle-notifications';

it('queues customer lifecycle notifications even without a staff group', async () => {
  const tx = {
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
    telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'customer' }) },
    botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  await enqueueRentalLifecycleNotifications(tx, {
    companyId: 'c1',
    rentalId: 'r1',
    operationId: 'op1',
    kind: 'HANDOVER',
    occurredAt: new Date(),
  });
  expect(tx.telegramIdentity.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        companyId: 'c1',
        kind: 'CLIENT',
        isActive: true,
        client: expect.objectContaining({ rentals: { some: { id: 'r1', companyId: 'c1' } } }),
      }),
    }),
  );
  expect(tx.botNotificationJob.createMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({
          identityId: 'customer',
          template: 'CLIENT_RENTAL_LIFECYCLE',
          eventKey: 'rental-lifecycle:op1:client:customer',
        }),
      ]),
      skipDuplicates: true,
    }),
  );
});
