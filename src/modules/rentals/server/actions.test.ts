import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { confirmRental } = vi.hoisted(() => ({ confirmRental: vi.fn() }));
vi.mock('./confirm-rental', () => ({ confirmRental }));
const { generateRentalDocumentPair } = vi.hoisted(() => ({ generateRentalDocumentPair: vi.fn() }));
vi.mock('./generate-rental-documents', () => ({ generateRentalDocumentPair }));
const { requireRentalAccess } = vi.hoisted(() => ({ requireRentalAccess: vi.fn() }));
vi.mock('./access', () => ({
  requireRentalAccess,
  RentalAccessDeniedError: class RentalAccessDeniedError extends Error {},
}));
const { prisma } = vi.hoisted(() => ({
  prisma: { $transaction: vi.fn(), rentalOperation: { findFirst: vi.fn() } },
}));
vi.mock('@/database/prisma/client', () => ({ prisma }));
const { executeReturnOperation } = vi.hoisted(() => ({ executeReturnOperation: vi.fn() }));
vi.mock('@/modules/rentals/operations/server/execute-operation', () => ({
  executeHandoverOperation: vi.fn(),
  executeReturnOperation,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  confirmAndGenerateRentalAction,
  confirmRentalAction,
  createRentalDraftAction,
  generateRentalDocumentsAction,
  returnRentalAction,
} from './actions';

describe('rental actions', () => {
  beforeEach(() => {
    confirmRental.mockReset();
    generateRentalDocumentPair.mockReset();
    requireRentalAccess.mockReset();
    prisma.$transaction.mockReset();
    prisma.rentalOperation.findFirst.mockReset();
    executeReturnOperation.mockReset();
  });

  it('passes optional return evidence through without making it mandatory', async () => {
    requireRentalAccess.mockResolvedValue({
      user: { id: 'user-1', email: 'staff@example.test' },
      scope: 'COMPANY',
    });
    executeReturnOperation.mockResolvedValue({ operationId: 'return-1', rentalId: 'rental-1' });
    prisma.rentalOperation.findFirst.mockResolvedValue({
      mileageKm: 10_500,
      vehicle: { id: 'vehicle-1', odometerKm: 10_500 },
      media: [{ id: 'panel' }, { id: 'front' }],
    });
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');
    form.set('idempotencyKey', 'return-rental-1-1');
    form.set('occurredAt', '2026-09-06T13:00');
    form.set('mileageKm', '10500');
    form.set('fuelLevelPercent', '50');
    form.set('vehicleCondition', 'GOOD');
    form.set('depositStatus', 'RETURNED');
    form.set('dashboardPhoto', new File(['photo'], 'panel.jpg', { type: 'image/jpeg' }));
    form.set('bodyPhotoFront', new File(['front'], 'front.jpg', { type: 'image/jpeg' }));

    await expect(returnRentalAction(null, form)).resolves.toMatchObject({
      ok: true,
      rentalId: 'rental-1',
      mileageKm: 10_500,
      savedMediaCount: 2,
    });
    expect(executeReturnOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        command: expect.objectContaining({
          evidenceStatus: 'VIDEO_MISSING',
          evidenceMissingReason: 'Файловая фиксация возврата приложена частично или пропущена.',
        }),
      }),
    );
    expect(executeReturnOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardPhoto: expect.objectContaining({ name: 'panel.jpg' }),
        additionalFiles: [
          expect.objectContaining({
            kind: 'BODY_PHOTO_FRONT',
            file: expect.objectContaining({ name: 'front.jpg' }),
          }),
        ],
      }),
    );
  });

  it('retains the canonical hidden depositMinor in a saved draft issuance snapshot', async () => {
    const rentalCreate = vi.fn().mockResolvedValue({ id: 'rental-1' });
    const transaction = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1' }) },
      vehicle: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'vehicle-1',
          dailyPriceMinor: 100000,
          depositMinor: BigInt(500000),
          includedMileageKm: 300,
          overageMileagePriceMinor: BigInt(1000),
          missingFuelPriceMinor: BigInt(5000),
        }),
      },
      contractTemplateVersion: { findFirst: vi.fn().mockResolvedValue({ id: 'template-1' }) },
      rental: { create: rentalCreate },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    requireRentalAccess.mockResolvedValue({ user: { id: 'user-1', email: 'staff@example.test' } });
    prisma.$transaction.mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('clientId', 'client-1');
    form.set('vehicleId', 'vehicle-1');
    form.set('templateVersionId', 'template-1');
    form.set('startsAt', '2026-08-20T10:00:00.000Z');
    form.set('endsAt', '2026-08-21T10:00:00.000Z');
    form.set('depositMinor', '125000');

    await expect(createRentalDraftAction(null, form)).resolves.toEqual({
      ok: true,
      rentalId: 'rental-1',
    });
    expect(rentalCreate.mock.calls[0]?.[0].data.snapshot).toMatchObject({
      issuance: { depositMinor: 125000 },
    });
    expect(transaction.vehicle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'vehicle-1',
          companyId: 'company-1',
          archivedAt: null,
          isDemoImport: false,
        },
      }),
    );
  });
  it('reserves cancellation for draft and confirmed states', () => {
    expect(['DRAFT', 'CONFIRMED']).toContain('CONFIRMED');
    expect(['DRAFT', 'CONFIRMED']).not.toContain('ACTIVE');
  });

  it('confirms only the requested tenant rental through the hardened transaction', async () => {
    confirmRental.mockResolvedValueOnce({
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
    });
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');

    await expect(confirmRentalAction(null, form)).resolves.toEqual({
      ok: true,
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
    });
    expect(confirmRental).toHaveBeenCalledWith('company-1', 'rental-1');
  });

  it('maps a unique contract-number conflict to a stable user-safe result', async () => {
    confirmRental.mockRejectedValueOnce({ code: 'P2002' });
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');
    await expect(confirmRentalAction(null, form)).resolves.toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Договор уже подтверждён или номер занят. Обновите страницу.',
    });
  });

  it('returns a specific safe overlap result without exposing rental details', async () => {
    confirmRental.mockRejectedValueOnce(new Error('Автомобиль уже занят на выбранный период.'));
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');
    await expect(confirmRentalAction(null, form)).resolves.toEqual({
      ok: false,
      code: 'OVERLAP',
      message: 'Автомобиль уже занят на выбранный период.',
    });
  });

  it('generates the protected document pair after successful confirmation', async () => {
    confirmRental.mockResolvedValueOnce({
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
    });
    generateRentalDocumentPair.mockResolvedValueOnce({ version: 2 });
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');

    await expect(confirmAndGenerateRentalAction(null, form)).resolves.toEqual({
      ok: true,
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
      documentVersion: 2,
    });
    expect(generateRentalDocumentPair).toHaveBeenCalledWith({
      companyId: 'company-1',
      rentalId: 'rental-1',
    });
  });

  it('keeps the confirmed rental addressable when pair generation fails', async () => {
    confirmRental.mockResolvedValueOnce({
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
    });
    generateRentalDocumentPair.mockRejectedValueOnce(new Error('converter failed'));
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');

    await expect(confirmAndGenerateRentalAction(null, form)).resolves.toMatchObject({
      ok: false,
      code: 'DOCUMENT_FAILED',
      confirmedNeedsDocuments: true,
      rentalId: 'rental-1',
    });
  });

  it('retries only durable pair generation for an already confirmed rental', async () => {
    generateRentalDocumentPair.mockResolvedValueOnce({ version: 3 });
    const form = new FormData();
    form.set('companyId', 'company-1');
    form.set('rentalId', 'rental-1');
    await expect(generateRentalDocumentsAction(null, form)).resolves.toMatchObject({
      ok: true,
      rentalId: 'rental-1',
      documentVersion: 3,
    });
    expect(confirmRental).not.toHaveBeenCalled();
  });
});
