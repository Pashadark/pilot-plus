import type { FuelType, PrismaClient, VehicleStatus } from '../generated/prisma';

const prefix = 'real-fleet:';
const retiredPrefix = 'example-fleet:';
export const approvedRentalFleet = [
  [
    'kia-ceed-2020',
    'Kia',
    "Cee'd",
    'А429АУ997',
    2020,
    335000,
    'XWEH4816BL0002046',
    '99 93 487086',
    '1643 01010045360',
    'ANSP567702974',
    1000000,
  ],
  [
    'skoda-octavia-2019',
    'Skoda',
    'Octavia',
    'Е435АН997',
    2019,
    283300,
    'XW8AN2NE3LH014538',
    '99 93 487396',
    null,
    'ANSP567703462',
    2000000,
  ],
  [
    'mercedes-e220d-2019',
    'Mercedes-Benz',
    'E 220 d 4MATIC',
    'М283АМ997',
    2019,
    700000,
    'WDD2130051A613993',
    '99 93 487761',
    '50РХ 575036',
    'ANSP568429144',
    2000000,
  ],
  [
    'kia-cerato-2021',
    'Kia',
    'Cerato',
    'С886АУ997',
    2021,
    430000,
    'XWEFB416BLC001001',
    '99 93 487074',
    null,
    'ANSP568110355',
    1500000,
  ],
  [
    'toyota-camry-2022',
    'Toyota',
    'Camry',
    'Н26АХ550',
    2022,
    450000,
    null,
    null,
    null,
    null,
    1500000,
  ],
  [
    'volkswagen-polo-a156-2020',
    'Volkswagen',
    'Polo',
    'А156АХ997',
    2020,
    300000,
    'XW8ZZZCKZMG001900',
    '99 93 486933',
    '1643 01011190990',
    'XXX 0682284894',
    2000000,
  ],
  [
    'kia-k5-2021',
    'Kia',
    'K5',
    'В342НР797',
    2021,
    600000,
    'XWEG2414BM0002195',
    '99 93 487397',
    '1643 01019180485',
    'ANSP568406076',
    3000000,
  ],
  [
    'volkswagen-polo-r400-2020',
    'Volkswagen',
    'Polo',
    'Р400АМ997',
    2020,
    350000,
    'XW8ZZZCKZMG024101',
    '99 93 487559',
    '1643 01017466630',
    'ANSP568513655',
    1000000,
  ],
  [
    'skoda-octavia-2020',
    'Skoda',
    'Octavia',
    'Т949АМ997',
    2020,
    400000,
    'XW8AN2NE1LH019852',
    '99 93 487652',
    '1643 01002908141',
    'ANSP568512837',
    1500000,
  ],
] as const;

type DemoCompanyContractDatabase = {
  company: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, string> }): Promise<unknown>;
  };
};

export type RentalFleetSeedDatabase = Pick<PrismaClient, 'vehicle'>;

const demoCompanyContractDefaults = {
  legalName: 'DEMO ONLY ООО «Пилот Рент»',
  inn: '0000000000',
  ogrn: '0000000000000',
  legalAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
  actualAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
  bankName: 'DEMO ONLY БАНК',
  settlementAccount: '00000000000000000000',
  correspondentAccount: '00000000000000000000',
  bik: '000000000',
  contractCity: 'Москва',
  defaultPickupAddress: 'DEMO ONLY, Москва, пункт выдачи',
  defaultReturnAddress: 'DEMO ONLY, Москва, пункт возврата',
  signatoryName: 'DEMO ONLY Подписант',
  signatoryAuthority: 'Устав (DEMO ONLY)',
} as const;

function isEmpty(value: unknown) {
  return (
    value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
  );
}

export async function seedDemoCompanyContractDefaults(
  database: DemoCompanyContractDatabase,
  companyId: string,
) {
  const company = await database.company.findUnique({ where: { id: companyId } });
  if (company?.isDemo !== true) return { updated: false };

  const data = Object.fromEntries(
    Object.entries(demoCompanyContractDefaults).filter(([field]) => isEmpty(company[field])),
  );
  if (!Object.keys(data).length) return { updated: false };
  await database.company.update({ where: { id: companyId }, data });
  return { updated: true };
}

function plate(value: string) {
  return value.replace(/[^A-Za-zА-Яа-я0-9]/gu, '').toUpperCase();
}

export async function seedApprovedRentalFleet(
  database: RentalFleetSeedDatabase,
  companyId: string,
) {
  const keys = new Set(approvedRentalFleet.map(([key]) => `${prefix}${key}`));
  const stale = await database.vehicle.findMany({
    where: {
      companyId,
      archivedAt: null,
      OR: [
        { isDemoImport: true },
        { sourceKey: { startsWith: prefix } },
        { sourceKey: { startsWith: retiredPrefix } },
      ],
    },
    select: { id: true, sourceKey: true },
  });
  const staleIds = stale.filter((item) => !keys.has(item.sourceKey)).map((item) => item.id);
  if (staleIds.length)
    await database.vehicle.updateMany({
      where: { id: { in: staleIds }, companyId },
      data: { archivedAt: new Date() },
    });
  for (const [
    index,
    [
      key,
      make,
      modelName,
      registrationNumber,
      manufacturedYear,
      dailyPriceMinor,
      vin,
      registrationCertificateNumber,
      vehiclePassportNumber,
      osagoPolicyNumber,
      depositMinor,
    ],
  ] of approvedRentalFleet.entries()) {
    const sourceKey = `${prefix}${key}`;
    const data = {
      companyId,
      sourceKey,
      vin,
      internalNumber: `ПАРК-${String(index + 1).padStart(2, '0')}`,
      model: `${make} ${modelName}`,
      make,
      modelName,
      registrationNumber,
      registrationNumberNormalized: plate(registrationNumber),
      manufacturedYear,
      city: 'Москва',
      office: 'Основной автопарк',
      transmission: 'Автомат',
      engineLiters: 1.6,
      fuelType: 'PETROL' as FuelType,
      seats: 5,
      dailyPriceMinor,
      currency: 'RUB',
      depositMinor: BigInt(depositMinor),
      includedMileageKm: 250,
      overageMileagePriceMinor: BigInt(1000),
      missingFuelPriceMinor: BigInt(5000),
      registrationCertificateNumber,
      vehiclePassportNumber,
      osagoInsurer: osagoPolicyNumber ? 'Страховая компания не указана' : null,
      osagoPolicyNumber,
      osagoStartsAt: null,
      osagoEndsAt: null,
      cascoInsurer: null,
      cascoPolicyNumber: null,
      cascoStartsAt: null,
      cascoEndsAt: null,
      originalPrice: 'Рабочий тариф из автопарка на 16.08.2026',
      features: ['Реальный автопарк'],
      status: 'IDLE' as VehicleStatus,
      isDemoImport: false,
      isRentalReady: false,
      rentalReadyAt: null,
      archivedAt: null,
    };
    const existing = await database.vehicle.findFirst({
      where: { companyId, registrationNumberNormalized: data.registrationNumberNormalized },
      select: { id: true },
    });
    if (existing) await database.vehicle.update({ where: { id: existing.id }, data });
    else await database.vehicle.upsert({ where: { sourceKey }, create: data, update: data });
  }
  return { vehicles: approvedRentalFleet.length };
}
