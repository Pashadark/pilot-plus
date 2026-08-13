import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { confirmRental } = vi.hoisted(() => ({ confirmRental: vi.fn() }));
vi.mock('./confirm-rental', () => ({ confirmRental }));

import { confirmRentalAction } from './actions';

describe('rental actions', () => {
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
});
