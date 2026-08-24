import { describe, expect, it } from 'vitest';

import { clientRentalColor, presentClientDeposit } from './client-deposit';

const rental = {
  id: 'rental-1',
  contractNumber: 'ME-2026-0001',
  status: 'ACTIVE' as const,
  startsAt: '2026-08-20T10:00:00.000Z',
  endsAt: '2026-08-26T10:00:00.000Z',
  vehicle: { label: 'Kia K5', registrationNumber: 'В342НР797' },
  totalPriceMinor: '3000000',
  depositMinor: '2000000',
  depositStatus: 'COLLECTED' as const,
};

describe('client deposit presentation', () => {
  it('shows a collected current deposit as money that must be returned', () => {
    expect(presentClientDeposit(rental, true)).toMatchObject({
      amount: '20 000 ₽',
      label: 'Нужно вернуть',
      tone: 'warning',
    });
  });

  it('marks the deposit of a past rental as the last one', () => {
    expect(presentClientDeposit({ ...rental, depositStatus: 'RETURNED' }, false)).toMatchObject({
      label: 'Последний · Возвращён',
      tone: 'success',
    });
  });

  it('uses operational colors for active, resolved and unresolved rentals', () => {
    expect(clientRentalColor(rental, true)).toBe('success');
    expect(clientRentalColor({ ...rental, depositStatus: 'RETURNED' }, false)).toBe('primary');
    expect(clientRentalColor({ ...rental, depositStatus: null }, false)).toBe('warning');
  });
});
