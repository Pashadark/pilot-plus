import { expect, it, vi } from 'vitest';
import { claimNotificationJobs } from './notifications';

it('hydrates extension without mileage or fuel, with dates, amount and escaped names', async () => {
  const tx = {
    telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-123' }) },
    botNotificationJob: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'j', claimToken: null, leaseExpiresAt: null, status: 'PENDING' },
        ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'j',
        companyId: 'c',
        claimToken: 'w:j',
        template: 'RENTAL_LIFECYCLE',
        payload: { kind: 'EXTENSION', rentalId: 'r', operationId: 'o' },
        identity: null,
        chatId: '-123',
      }),
    },
    rentalOperation: {
      findFirst: vi.fn().mockResolvedValue({
        type: 'EXTENSION',
        occurredAt: new Date('2026-09-19T06:40:00Z'),
        mileageKm: null,
        fuelLevelPercent: null,
        previousEndsAt: new Date('2026-09-19T07:30:00Z'),
        nextEndsAt: new Date('2026-09-20T07:30:00Z'),
        extensionChargeMinor: BigInt(600000),
        actor: { name: 'Павел' },
        rental: {
          contractNumber: '0045',
          client: { firstName: '<Павел>', lastName: 'Ковалев' },
          vehicle: {
            make: 'Kia',
            modelName: 'Cerato',
            model: 'Cerato',
            registrationNumber: 'С886АУ997',
          },
        },
      }),
    },
  };
  const [job] = await claimNotificationJobs(new Date(), 'w', {
    $transaction: async (work: (arg: typeof tx) => unknown) => work(tx),
  } as never);
  const payload = job.payload as { message: string; parseMode: string };
  expect(payload.parseMode).toBe('HTML');
  expect(payload.message).toContain('Аренда продлена');
  expect(payload.message).toContain('20.09.2026, 10:30');
  expect(payload.message).toContain('С886АУ997');
  expect(payload.message).toContain('&lt;Павел&gt;');
  expect(tx.rentalOperation.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'o', companyId: 'c', rentalId: 'r', status: 'COMMITTED', type: 'EXTENSION' },
    }),
  );
});
