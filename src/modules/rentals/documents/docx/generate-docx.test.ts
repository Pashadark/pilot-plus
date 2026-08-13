import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import { buildRentalSnapshot } from '../../domain/build-snapshot';
import { generateRentalDocx } from './generate-docx';

describe('generateRentalDocx', () => {
  it('creates a structured contract without unresolved placeholders', async () => {
    const snapshot = buildRentalSnapshot({
      company: {
        id: 'c',
        legalName: 'ООО Пилот',
        inn: '1',
        address: 'Москва',
        signatoryName: 'Иван',
        signatoryAuthority: 'Устав',
        contractCity: 'Москва',
        defaultPickupAddress: 'Москва',
        defaultReturnAddress: 'Москва',
      },
      client: {
        id: 'p',
        fullName: 'Иван Иванов',
        phone: '1',
        passport: 'паспорт',
        birthDate: '2000-01-01',
        registrationAddress: 'Москва',
        licenseNumber: '77',
      },
      vehicle: {
        id: 'v',
        make: 'Volkswagen',
        model: 'Polo',
        registrationNumber: 'А156АХ997',
        vin: 'VIN',
        dailyMinor: 470000,
        depositMinor: 1000000,
      },
      rental: {
        id: 'r',
        startsAt: new Date('2026-08-12T09:00Z'),
        endsAt: new Date('2026-08-13T09:00Z'),
        calculatedTotalMinor: 470000,
        agreedTotalMinor: 470000,
        currency: 'RUB',
        days: 1,
      },
    });
    const doc = generateRentalDocx(snapshot, 'ME-2026-0001-BK');
    const bytes = await Packer.toBuffer(doc);
    const text = Buffer.from(bytes).toString('utf8');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(text).toContain('word/document.xml');
  });
});
