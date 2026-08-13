import { describe, expect, it } from 'vitest';
import { rentalDetailPresentation } from './rental-detail-presentation';

describe('rentalDetailPresentation', () => {
  it('uses confirmed immutable snapshot data rather than mutable live entities', () => {
    const view = rentalDetailPresentation({
      status: 'CONFIRMED',
      snapshot: {
        client: { fullName: 'Снимок Клиента' },
        vehicle: { make: 'Снимок', model: 'Polo', registrationNumber: 'А111АА77' },
        rental: {
          startsAt: '2026-08-01T09:00:00.000Z',
          endsAt: '2026-08-02T09:00:00.000Z',
          agreedTotalMinor: 450000,
          pickupAddress: 'Снимок выдача',
          returnAddress: 'Снимок возврат',
        },
        issuance: { territory: 'Москва' },
      },
      clientLabel: 'Изменённый клиент',
      vehicleLabel: 'Изменённый автомобиль',
      startsAt: '2026-09-01T09:00:00.000Z',
      endsAt: '2026-09-02T09:00:00.000Z',
      totalPriceMinor: BigInt(999999),
    });
    expect(view.source).toBe('Снимок подтверждённого договора');
    expect(view.client).toBe('Снимок Клиента');
    expect(view.vehicle).toContain('Снимок Polo');
    expect(view.term).toContain('01.08.2026');
    expect(view.totalMinor).toBe(450000);
    expect(view.issuance?.territory).toBe('Москва');
  });
});
