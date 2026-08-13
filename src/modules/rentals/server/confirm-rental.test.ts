import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createRentalConfirmation } from './confirm-rental';

describe('atomic rental confirmation', () => {
  it('rejects overlapping confirmed rentals using half-open intervals', async () => {
    const confirm = createRentalConfirmation({
      async transaction(work) {
        return work({ rental: { findFirst: async () => ({ id: 'occupied' }) } } as never);
      },
    });
    await expect(confirm({ companyId: 'company-1', rentalId: 'rental-1' })).rejects.toThrow(
      'Автомобиль уже занят',
    );
  });
});
