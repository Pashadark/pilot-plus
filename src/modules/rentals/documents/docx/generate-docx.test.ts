import { inflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { buildRentalSnapshot } from '../../domain/build-snapshot';
import { generateRentalDocx } from './generate-docx';

function documentXml(bytes: Uint8Array) {
  const zip = Buffer.from(bytes);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(eocd + 16);
  const entries = zip.readUInt16LE(eocd + 10);
  for (let index = 0; index < entries; index += 1) {
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === 'word/document.xml') {
      const method = zip.readUInt16LE(localOffset + 8);
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const data = zip.subarray(
        localOffset + 30 + localNameLength + localExtraLength,
        localOffset + 30 + localNameLength + localExtraLength + compressedSize,
      );
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error('word/document.xml не найден');
}

async function completeContractXml(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes);
  const document = await archive.file('word/document.xml')!.async('string');
  const header = await archive.file('word/header1.xml')!.async('string');
  return `${header}\n${document}`;
}

function visibleText(value: string) {
  return [...value.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gu)]
    .map((match) =>
      (match[1] ?? '')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'")
        .replaceAll('&amp;', '&'),
    )
    .join('');
}

const snapshot = buildRentalSnapshot({
  company: {
    id: 'c',
    legalName: 'ООО Пилот',
    inn: '7700000000',
    kpp: '770001001',
    ogrn: '1027700000000',
    address: 'Москва, ул. Пример, 1',
    signatoryName: 'Иван Петров',
    signatoryAuthority: 'Устав',
    contractCity: 'Москва',
    defaultPickupAddress: 'Москва, Тверская, 1',
    defaultReturnAddress: 'Москва, Тверская, 2',
    bankName: 'Банк',
    settlementAccount: '40702810000000000001',
    correspondentAccount: '30101810000000000001',
    bik: '044525225',
  },
  client: {
    id: 'p',
    fullName: 'Иван Иванов',
    phone: '+79990000000',
    passport: '45 01 123456',
    birthDate: '2000-01-01',
    registrationAddress: 'Москва',
    residentialAddress: 'Москва, ул. Дом, 2',
    licenseNumber: '77 01 123456',
    licenseIssuedAt: '2020-01-01',
    licenseExpiresAt: '2030-01-01',
  },
  vehicle: {
    id: 'v',
    make: 'Volkswagen',
    model: 'Polo',
    registrationNumber: 'А156АХ997',
    vin: 'VIN',
    dailyMinor: 470000,
    depositMinor: 1000000,
    registrationCertificateNumber: 'СТС',
    vehiclePassportNumber: 'ПТС',
    osagoInsurer: 'Страховщик',
    osagoPolicyNumber: 'ОСАГО',
    osagoStartsAt: '2026-01-01',
    osagoEndsAt: '2027-01-01',
    cascoInsurer: 'КАСКО',
    cascoPolicyNumber: 'КАСКО-1',
  },
  rental: {
    id: 'r',
    startsAt: new Date('2026-08-12T09:00:00Z'),
    endsAt: new Date('2026-08-13T09:00:00Z'),
    calculatedTotalMinor: 470000,
    agreedTotalMinor: 450000,
    discountMinor: 20000,
    servicesMinor: 0,
    depositMinor: 1000000,
    currency: 'RUB',
    days: 1,
    pickupAddress: 'Москва, Тверская, 1',
    returnAddress: 'Москва, Тверская, 2',
    conditions: 'Пробег 300 км/сутки',
  },
});

const issuedSnapshot = {
  ...snapshot,
  issuance: {
    pickupAddress: 'Москва, DEMO ONLY, выдача',
    returnAddress: 'Москва, DEMO ONLY, возврат',
    startMileageKm: '12000',
    returnMileageKm: '12550',
    startFuelPercent: '80',
    returnFuelPercent: '45',
    territory: 'Москва и МО',
    paymentTerms: 'DEMO ONLY: оплата при выдаче',
    allowedDrivers: 'Иванов Иван; Петров Пётр',
  },
};

describe('generateRentalDocx', () => {
  it('returns DOCX bytes with complete contract data and structural tables', async () => {
    const bytes = await generateRentalDocx(snapshot, {
      contractNumber: 'ME-2026-0001-BK',
      templateVersion: 'legal-content-v1',
    });
    const xml = documentXml(bytes);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(xml).toContain('ME-2026-0001-BK');
    expect(xml).toContain('А156АХ997');
    expect(xml).toContain('Иван Петров');
    expect(xml).toContain('45 01 123456');
    expect(xml).toContain('77 01 123456');
    expect(xml).toContain('Страховщик');
    expect(xml).toContain('Приложение № 1');
    expect(xml).toContain('Штрафы');
    expect((xml.match(/<w:tbl/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(xml).not.toMatch(/{{[^}]+}}/);
  });

  it('uses the approved full rental contract and replaces every reference customer value', async () => {
    const xml = visibleText(
      await completeContractXml(
        await generateRentalDocx(snapshot, {
          contractNumber: 'ME-2026-0001-BK',
          templateVersion: 'legal-content-v1',
        }),
      ),
    );

    expect(xml).toContain('ДОГОВОР ПРОКАТА ТРАНСПОРТНОГО СРЕДСТВА (БЕЗ ЭКИПАЖА)');
    expect(xml).toContain('ПОРЯДОК ВОЗВРАТА И УДЕРЖАНИЯ ЗАЛОГА');
    expect(xml).toContain('Возврат (сдача) автомобиля после окончания аренды третьим лицом');
    expect(xml).toContain('ME-2026-0001-BK');
    expect(xml).toContain('Иван Иванов');
    expect(xml).toContain('А156АХ997');
    expect(xml).not.toContain('Кульпинёв');
    expect(xml).not.toContain('BMW 520D XDRIVE');
    expect(xml).not.toContain('В415ЕВ250');
    expect(xml).not.toContain('23 24 № 211104');
  });

  it('uses a deterministic Moscow date format and the selected legal template', async () => {
    const bytes = await generateRentalDocx(snapshot, {
      contractNumber: 'ME-2026-0001-BK',
      templateVersion: 'legal-content-v1',
    });
    const xml = documentXml(bytes);
    expect(xml).toContain('12.08.2026');
    expect(xml).toContain('ДЕЙСТВИЕ ДОГОВОРА');
  });

  it('prints the daily and total mileage allowance for the whole rental term', async () => {
    const fourDaySnapshot = {
      ...snapshot,
      vehicle: { ...snapshot.vehicle, includedMileageKm: 200 },
      rental: { ...snapshot.rental, days: 4 },
    };
    const xml = visibleText(
      documentXml(
        await generateRentalDocx(fourDaySnapshot, {
          contractNumber: 'ME-2026-MILEAGE',
          templateVersion: 'legal-content-v1',
        }),
      ),
    );

    expect(xml).toContain('включённый пробег 200 км/сутки, всего 800 км');
  });

  it('uses the 200 km daily policy for a legacy standard snapshot without mileage', async () => {
    const legacySnapshot = {
      ...snapshot,
      vehicle: { ...snapshot.vehicle, includedMileageKm: null },
      rental: { ...snapshot.rental, days: 10 },
    };
    const xml = visibleText(
      documentXml(
        await generateRentalDocx(legacySnapshot, {
          contractNumber: 'ME-2026-LEGACY-MILEAGE',
          templateVersion: 'legal-content-v1',
        }),
      ),
    );

    expect(xml).toContain('включённый пробег 200 км/сутки, всего 2000 км');
  });

  it('omits mileage allowance for a lease-to-own snapshot', async () => {
    const leaseSnapshot = {
      ...snapshot,
      agreementType: 'LEASE_TO_OWN',
      vehicle: { ...snapshot.vehicle, includedMileageKm: null },
      rental: { ...snapshot.rental, days: 30 },
    };
    const xml = documentXml(
      await generateRentalDocx(leaseSnapshot, {
        contractNumber: 'ME-2026-LEASE',
        templateVersion: 'legal-content-v1',
      }),
    );

    expect(xml).not.toContain('включённый пробег');
  });

  it('renders immutable issuance details without substituting the primary client as a driver', async () => {
    const xml = visibleText(
      documentXml(
        await generateRentalDocx(issuedSnapshot, {
          contractNumber: 'ME-2026-ISSUANCE',
          templateVersion: 'legal-content-v1',
        }),
      ),
    );

    for (const value of [
      'Москва, DEMO ONLY, выдача',
      'Москва, DEMO ONLY, возврат',
      '12000',
      '12550',
      '80',
      '45',
      'Москва и МО',
      'DEMO ONLY: оплата при выдаче',
      'Иванов Иван; Петров Пётр',
    ])
      expect(xml).toContain(value);
    expect(xml).not.toContain('Допущенные водителиИван Иванов');
  });

  it('renders every absent optional snapshot value as an em dash', async () => {
    const sparse = {
      ...snapshot,
      company: { ...snapshot.company, actualAddress: null, bankName: null, kpp: null },
      client: {
        ...snapshot.client,
        phone: null,
        residentialAddress: null,
        licenseIssuedAt: null,
        licenseExpiresAt: null,
      },
      vehicle: {
        ...snapshot.vehicle,
        year: null,
        color: null,
        bodyType: null,
        transmission: null,
        fuelType: null,
        seats: null,
        cascoInsurer: null,
        cascoPolicyNumber: null,
        cascoStartsAt: null,
        cascoEndsAt: null,
        includedMileageKm: null,
        overageMileagePriceMinor: null,
        missingFuelPriceMinor: null,
      },
      rental: {
        ...snapshot.rental,
        discountMinor: null,
        servicesMinor: null,
        depositMinor: null,
        conditions: null,
        pickupAddress: null,
        returnAddress: null,
      },
    };
    const xml = documentXml(
      await generateRentalDocx(sparse, {
        contractNumber: 'ME-2026-0002-SPARSE',
        templateVersion: 'legal-content-v1',
      }),
    );
    expect(xml).not.toMatch(/undefined|null/);
    expect(xml).toContain('—');
    expect(xml).toContain('ЦВЕТ');
    expect(xml).toContain('ТОПЛИВО');
    expect(xml).not.toContain('Кульпинёв');
  });
});
