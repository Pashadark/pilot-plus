import { describe, expect, it, vi } from 'vitest';

import { createBookingFinalizer } from './workflow';

const receipt = {
  uploadId: 'upload-1',
  storageKey: 'companies/company-1/rentals/rental-1/rental-payment-receipts/upload-1.jpg',
  originalName: 'receipt.jpg',
  verifiedMime: 'image/jpeg' as const,
  bytes: 4,
  sha256: 'sha',
  scanEngine: 'ClamAV',
  signatureVersion: '1',
  scannedAt: new Date('2026-10-07T12:00:00.000Z'),
};

function fixture(overlap = false) {
  const transaction = {
    rental: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'rental-1',
          companyId: 'company-1',
          status: 'CONFIRMED',
          totalPriceMinor: BigInt(12_000_00),
          contractNumber: 'ME-2026-0081-BK',
          vehicleId: 'vehicle-1',
          startsAt: new Date('2026-11-15T09:00:00.000Z'),
          endsAt: new Date('2026-11-18T09:00:00.000Z'),
        })
        .mockResolvedValueOnce(overlap ? { id: 'other-rental' } : null),
    },
    rentalPayment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    },
    rentalPaymentReceipt: { create: vi.fn().mockResolvedValue({ id: 'receipt-1' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)),
  };
  return { database, transaction };
}

describe('createBookingFinalizer', () => {
  it('rejects a booking when another confirmed rental overlaps the interval', async () => {
    const { database } = fixture(true);
    const finalize = createBookingFinalizer(database as never);

    await expect(
      finalize({
        companyId: 'company-1',
        rentalId: 'rental-1',
        actorUserId: 'user-1',
        actorEmail: 'owner@example.com',
        idempotencyKey: 'booking:rental-1',
        receipt,
      }),
    ).rejects.toThrow('VEHICLE_UNAVAILABLE');
  });

  it('records the rent payment and receipt only once', async () => {
    const { database, transaction } = fixture();
    const finalize = createBookingFinalizer(database as never);

    await expect(
      finalize({
        companyId: 'company-1',
        rentalId: 'rental-1',
        actorUserId: 'user-1',
        actorEmail: 'owner@example.com',
        idempotencyKey: 'booking:rental-1',
        receipt,
      }),
    ).resolves.toEqual({
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0081-BK',
      paymentId: 'payment-1',
      reused: false,
    });
    expect(transaction.rentalPayment.create).toHaveBeenCalledTimes(1);
    expect(transaction.rentalPaymentReceipt.create).toHaveBeenCalledTimes(1);
  });
});
