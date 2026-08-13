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

  it('has no undefined values and rejects unsafe money or incomplete confirmed legal snapshots', () => {
    expect(() =>
      buildRentalSnapshot({
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
          dailyMinor: 1,
          depositMinor: 0,
        },
        rental: {
          id: 'rental',
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 1),
          calculatedTotalMinor: 1,
          agreedTotalMinor: 1,
          currency: 'RUB',
          discountMinor: -1,
        },
      }),
    ).toThrow('безопас');
    const draft = buildRentalSnapshot({
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
        dailyMinor: 1,
        depositMinor: 0,
      },
      rental: {
        id: 'rental',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1),
        calculatedTotalMinor: 1,
        agreedTotalMinor: 1,
        currency: 'RUB',
      },
    });
    expect(JSON.stringify(draft)).not.toContain('undefined');
    expect(draft.completeness.warnings.length).toBeGreaterThan(0);
    expect(() =>
      buildRentalSnapshot({
        ...{
          company: { id: 'c', legalName: '', inn: '', address: '' },
          client: { id: 'p', fullName: '', phone: '', passport: '' },
          vehicle: {
            id: 'v',
            make: '',
            model: '',
            registrationNumber: '',
            vin: '',
            dailyMinor: 1,
            depositMinor: 0,
          },
          rental: {
            id: 'r',
            startsAt: new Date(),
            endsAt: new Date(Date.now() + 1),
            calculatedTotalMinor: 1,
            agreedTotalMinor: 1,
            currency: 'RUB',
          },
        },
        confirmedReady: true,
      }),
    ).toThrow('обязательные');
  });

  it('copies canonical persisted company contract fields', () => {
    const snapshot = buildRentalSnapshot({
      company: {
        id: 'c',
        legalName: 'ИП',
        inn: '1',
        address: 'x',
        entrepreneurName: 'Павел',
        lessorBirthDate: '1990-01-01',
        lessorPassportEncrypted: 'encrypted:opaque',
        ogrnip: '2',
        defaultPickupAddress: 'Выдача',
        defaultReturnAddress: 'Возврат',
        signatoryName: 'Павел',
        signatoryAuthority: 'Устав',
        contractCity: 'Москва',
      },
      client: { id: 'p', fullName: 'Иван', phone: '1', passport: 'p' },
      vehicle: {
        id: 'v',
        make: 'K',
        model: 'M',
        registrationNumber: 'А156АХ997',
        vin: 'V',
        dailyMinor: 1,
        depositMinor: 0,
      },
      rental: {
        id: 'r',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1),
        calculatedTotalMinor: 1,
        agreedTotalMinor: 1,
        currency: 'RUB',
      },
    });
    expect(snapshot.company).toMatchObject({
      entrepreneurName: 'Павел',
      lessorPassportEncrypted: 'encrypted:opaque',
      ogrnip: '2',
      defaultPickupAddress: 'Выдача',
      defaultReturnAddress: 'Возврат',
      signatoryAuthority: 'Устав',
    });
  });
});
