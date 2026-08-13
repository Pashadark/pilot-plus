import { describe, expect, it } from 'vitest';

import { buildRentalSnapshot } from '../../domain/build-snapshot';
import { generateRentalDocx } from '../docx/generate-docx';
import { convertDocxToPdf } from './convert-docx-to-pdf';

const enabled = process.env.RUN_RENTAL_DOCUMENT_CONVERTER_INTEGRATION === '1';

describe.skipIf(!enabled)('LibreOffice rental document conversion', () => {
  it('converts generated contract DOCX to a PDF byte stream', async () => {
    const snapshot = buildRentalSnapshot({
      confirmedReady: true,
      company: {
        id: 'company',
        legalName: 'ООО Пилот',
        inn: '7700000000',
        address: 'Москва',
        signatoryName: 'Иван Петров',
        signatoryAuthority: 'Устав',
        contractCity: 'Москва',
        defaultPickupAddress: 'Москва',
        defaultReturnAddress: 'Москва',
      },
      client: {
        id: 'client',
        fullName: 'Иван Иванов',
        phone: '+79990000000',
        passport: '45 01 123456',
        birthDate: '2000-01-01',
        registrationAddress: 'Москва',
        licenseNumber: '77 01 123456',
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
        startsAt: new Date('2026-08-12T09:00:00.000Z'),
        endsAt: new Date('2026-08-13T09:00:00.000Z'),
        calculatedTotalMinor: 470000,
        agreedTotalMinor: 470000,
        currency: 'RUB',
      },
    });

    const docx = await generateRentalDocx(snapshot, { contractNumber: 'ME-2026-0001-BK' });
    const pdf = await convertDocxToPdf(docx);

    expect(Buffer.from(pdf).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
