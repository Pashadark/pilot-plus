import { describe, expect, it } from 'vitest';
import { buildRentalSnapshot } from './build-snapshot';

describe('rental legal snapshot', () => {
  it('returns an immutable, versioned, serializable legal snapshot without Prisma values', () => {
    const snapshot = buildRentalSnapshot({
      company: { id: 'company', legalName: 'ООО Пилот', inn: '123', address: 'Москва' },
      client: {
        id: 'client',
        fullName: 'Иван Иванов',
        phone: '+79990000000',
        passport: 'safe-value',
      },
      vehicle: {
        id: 'vehicle',
        make: 'Volkswagen',
        model: 'Polo',
        registrationNumber: 'А156АХ997',
        vin: 'VIN',
        dailyMinor: 470000,
        depositMinor: 1000000,
      },
      rental: {
        id: 'rental',
        startsAt: new Date('2026-01-01T09:00Z'),
        endsAt: new Date('2026-01-02T09:00Z'),
        calculatedTotalMinor: 470000,
        agreedTotalMinor: 470000,
        currency: 'RUB',
      },
    });
    expect(snapshot.schemaVersion).toBe(1);
    expect(JSON.stringify(snapshot)).toContain('А156АХ997');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.rental.startsAt).toBe('2026-01-01T09:00:00.000Z');
  });
});
