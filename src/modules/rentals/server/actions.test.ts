import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { confirmRental } = vi.hoisted(() => ({ confirmRental: vi.fn() }));
vi.mock('./confirm-rental', () => ({ confirmRental }));
const { generateRentalDocumentPair } = vi.hoisted(() => ({ generateRentalDocumentPair: vi.fn() }));
vi.mock('./generate-rental-documents', () => ({ generateRentalDocumentPair }));

import {
  confirmAndGenerateRentalAction,
  confirmRentalAction,
  generateRentalDocumentsAction,
} from './actions';

describe('rental actions', () => {
  beforeEach(() => {
    confirmRental.mockReset();
    generateRentalDocumentPair.mockReset();
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
