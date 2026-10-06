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
  depositReturnedAt: null,
};

describe('client deposit presentation', () => {
  it('shows a collected current deposit as not returned', () => {
    expect(presentClientDeposit(rental, true)).toMatchObject({
      amount: '20 000 ₽',
      label: 'Не возвращён',
      tone: 'warning',
      returnedAtLabel: '—',
    });
  });

  it('shows only the factual return status for a past rental', () => {
    expect(
      presentClientDeposit(
        {
          ...rental,
          depositStatus: 'RETURNED',
          depositReturnedAt: '2026-09-01T08:15:00.000Z',
        },
        false,
      ),
    ).toMatchObject({
      label: 'Возвращён',
      tone: 'success',
      returnedAtLabel: '01.09.2026, 11:15',
    });
  });

  it('does not add a last-rental prefix or middle-dot separator', () => {
    const result = presentClientDeposit({ ...rental, depositStatus: 'COLLECTED' }, false);
    expect(result.label).toBe('Не возвращён');
    expect(result.label).not.toContain('Последний');
    expect(result.label).not.toContain('·');
  });

  it('uses operational colors for active, resolved and unresolved rentals', () => {
    expect(clientRentalColor(rental, true)).toBe('success');
    expect(clientRentalColor({ ...rental, depositStatus: 'RETURNED' }, false)).toBe('primary');
    expect(clientRentalColor({ ...rental, depositStatus: null }, false)).toBe('warning');
  });
});
