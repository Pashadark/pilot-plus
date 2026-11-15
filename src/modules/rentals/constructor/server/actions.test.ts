import { describe, expect, it, vi } from 'vitest';

import {
  createConstructorClientActionWith,
  createFinalizeRentalConstructorAction,
  saveConstructorDraftActionWith,
} from './actions';

function validClientFormData() {
  const formData = new FormData();
  formData.set('companyId', 'company-1');
  formData.set('firstName', 'Анна');
  formData.set('middleName', 'Петровна');
  formData.set('lastName', 'Щапова');
  formData.set('phone', '+7 950 080-99-08');
  return formData;
}

describe('createConstructorClientAction', () => {
  it('creates a tenant-scoped draft client and returns its id', async () => {
    const createClient = vi.fn().mockResolvedValue({
      status: 'success',
      message: 'Клиент создан.',
      clientId: 'client-1',
      client: {
        id: 'client-1',
        fullName: 'Щапова Анна Петровна',
        phone: '+7 950 080-99-08',
      },
    });
    const action = createConstructorClientActionWith(createClient);
    const formData = validClientFormData();

    const result = await action(null, formData);

    expect(formData.get('status')).toBe('DRAFT');
    expect(createClient).toHaveBeenCalledWith({ status: 'idle' }, formData);
    expect(result).toMatchObject({
      ok: true,
      client: { id: 'client-1', status: 'DRAFT' },
    });
  });

  it('preserves validation errors from existing client creation', async () => {
    const action = createConstructorClientActionWith(
      vi.fn().mockResolvedValue({
        status: 'error',
        message: 'Проверьте поля формы.',
        fieldErrors: { phone: 'Клиент с таким телефоном уже существует.' },
      }),
    );

    await expect(action(null, validClientFormData())).resolves.toMatchObject({
      ok: false,
      code: 'CLIENT_INVALID',
      fieldErrors: { phone: 'Клиент с таким телефоном уже существует.' },
    });
  });
});

describe('saveConstructorDraftAction', () => {
  it('reuses the same rental draft on repeated autosave', async () => {
    const createDraft = vi.fn().mockResolvedValue({
      ok: true,
      rentalId: 'rental-1',
      updatedAt: '2026-11-15T10:00:00.000Z',
      calculation: { days: 2, totalMinor: 600000, discountMinor: 0, servicesMinor: 0 },
    });
    const updateDraft = vi.fn().mockResolvedValue({
      ok: true,
      rentalId: 'rental-1',
      updatedAt: '2026-11-15T10:00:01.000Z',
      calculation: { days: 2, totalMinor: 600000, discountMinor: 0, servicesMinor: 0 },
    });
    const action = saveConstructorDraftActionWith(createDraft, updateDraft);
    const firstForm = validClientFormData();
    const first = await action(null, firstForm);
    const secondForm = validClientFormData();
    secondForm.set('rentalId', first.ok ? first.rentalId : '');
    const second = await action(null, secondForm);

    expect(first.ok && first.rentalId).toBe('rental-1');
    expect(second.ok && second.rentalId).toBe('rental-1');
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(updateDraft).toHaveBeenCalledTimes(1);
  });
});

function finalForm() {
  const formData = new FormData();
  formData.set('companyId', 'company-1');
  formData.set('rentalId', 'rental-1');
  formData.set('rentReceived', 'true');
  formData.set('depositReceived', 'true');
  formData.set('paymentMethod', 'CARD');
  return formData;
}

describe('finalizeRentalConstructorAction', () => {
  it('confirms once and records received payments idempotently', async () => {
    const findRental = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'DRAFT',
        totalPriceMinor: BigInt(12_000_00),
        depositMinor: BigInt(15_000_00),
      })
      .mockResolvedValueOnce({
        status: 'CONFIRMED',
        totalPriceMinor: BigInt(12_000_00),
        depositMinor: BigInt(15_000_00),
      });
    const confirm = vi.fn().mockResolvedValue({
      ok: true,
      rentalId: 'rental-1',
      contractNumber: 'ME-2026-0001-BK',
      documentVersion: 1,
    });
    const generateDocuments = vi.fn().mockResolvedValue({
      ok: true,
      rentalId: 'rental-1',
      documentVersion: 1,
    });
    const recordPayment = vi.fn().mockResolvedValue({ id: 'payment-1', reused: false });
    const finalize = createFinalizeRentalConstructorAction({
      requireAccess: vi.fn().mockResolvedValue({
        user: { id: 'user-1', email: 'owner@example.com' },
      }),
      findRental,
      saveDraft: vi.fn().mockResolvedValue({ ok: true, rentalId: 'rental-1' }),
      confirm,
      generateDocuments,
      recordPayment,
    });

    await expect(finalize(null, finalForm())).resolves.toMatchObject({ ok: true });
    await expect(finalize(null, finalForm())).resolves.toMatchObject({ ok: true });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(generateDocuments).toHaveBeenCalledTimes(1);
    expect(recordPayment).toHaveBeenCalledTimes(4);
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'RENT',
        amountMinor: BigInt(12_000_00),
        idempotencyKey: 'constructor:rental-1:rent',
      }),
    );
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'DEPOSIT',
        amountMinor: BigInt(15_000_00),
        idempotencyKey: 'constructor:rental-1:deposit',
      }),
    );
  });

  it('does not create payments that were not marked as received', async () => {
    const formData = finalForm();
    formData.set('rentReceived', 'false');
    formData.set('depositReceived', 'false');
    const recordPayment = vi.fn();
    const finalize = createFinalizeRentalConstructorAction({
      requireAccess: vi.fn().mockResolvedValue({
        user: { id: 'user-1', email: 'owner@example.com' },
      }),
      findRental: vi.fn().mockResolvedValue({
        status: 'DRAFT',
        totalPriceMinor: BigInt(12_000_00),
        depositMinor: BigInt(15_000_00),
      }),
      saveDraft: vi.fn().mockResolvedValue({ ok: true, rentalId: 'rental-1' }),
      confirm: vi.fn().mockResolvedValue({ ok: true, rentalId: 'rental-1' }),
      generateDocuments: vi.fn(),
      recordPayment,
    });

    await expect(finalize(null, formData)).resolves.toMatchObject({ ok: true });
    expect(recordPayment).not.toHaveBeenCalled();
  });

  it('returns the confirmed rental when document generation needs a safe retry', async () => {
    const recordPayment = vi.fn().mockResolvedValue({ id: 'payment-1', reused: false });
    const finalize = createFinalizeRentalConstructorAction({
      requireAccess: vi.fn().mockResolvedValue({
        user: { id: 'user-1', email: 'owner@example.com' },
      }),
      findRental: vi.fn().mockResolvedValue({
        status: 'DRAFT',
        totalPriceMinor: BigInt(12_000_00),
        depositMinor: BigInt(15_000_00),
      }),
      saveDraft: vi.fn().mockResolvedValue({ ok: true, rentalId: 'rental-1' }),
      confirm: vi.fn().mockResolvedValue({
        ok: false,
        code: 'DOCUMENT_FAILED',
        message: 'Файлы не готовы.',
        confirmedNeedsDocuments: true,
        rentalId: 'rental-1',
      }),
      generateDocuments: vi.fn(),
      recordPayment,
    });

    await expect(finalize(null, finalForm())).resolves.toMatchObject({
      ok: false,
      code: 'DOCUMENT_FAILED',
      confirmedNeedsDocuments: true,
      rentalId: 'rental-1',
    });
    expect(recordPayment).toHaveBeenCalledTimes(2);
  });
});
