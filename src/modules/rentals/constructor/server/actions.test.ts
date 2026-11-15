import { describe, expect, it, vi } from 'vitest';

import { createConstructorClientActionWith, saveConstructorDraftActionWith } from './actions';

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
