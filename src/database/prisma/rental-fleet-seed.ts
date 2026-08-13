const prefix = 'example-fleet:';
export const approvedRentalFleet = [
  ['kia-ceed-2020', 'Kia', "Cee'd", 'А429АУ97', 2020, 350000],
  ['skoda-octavia-2019', 'Skoda', 'Octavia', 'Е435АН997', 2019, 420000],
  ['mercedes-e220d-2019', 'Mercedes-Benz', 'E 220 d 4MATIC', 'М283АМ997', 2019, 850000],
  ['volkswagen-polo-2020', 'Volkswagen', 'Polo', 'А156АХ997', 2020, 470000],
] as const;

type DemoCompanyContractDatabase = {
  company: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, string> }): Promise<unknown>;
  };
};

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

export async function seedApprovedRentalFleet(database: any, companyId: string) {
  const keys = new Set(approvedRentalFleet.map(([key]) => `${prefix}${key}`));
  const stale = await database.vehicle.findMany({
    where: { companyId, isDemoImport: true, archivedAt: null, sourceKey: { startsWith: prefix } },
    select: { id: true, sourceKey: true },
  });
  const staleIds = stale
    .filter((item: { sourceKey: string }) => !keys.has(item.sourceKey))
    .map((item: { id: string }) => item.id);
  if (staleIds.length)
    await database.vehicle.updateMany({
      where: { id: { in: staleIds }, companyId, isDemoImport: true },
      data: { archivedAt: new Date() },
    });
  for (const [
    index,
    [key, make, modelName, registrationNumber, manufacturedYear, dailyPriceMinor],
  ] of approvedRentalFleet.entries()) {
    const sourceKey = `${prefix}${key}`;
    const data = {
      companyId,
      sourceKey,
      vin: `DEMO${String(index + 1).padStart(13, '0')}`,
      internalNumber: `DEMO-${key.toUpperCase()}`,
      model: `${make} ${modelName}`,
      make,
      modelName,
      registrationNumber,
      registrationNumberNormalized: plate(registrationNumber),
      manufacturedYear,
      city: 'Москва',
      office: 'Демо-парк',
      transmission: 'Автомат',
      engineLiters: 1.6,
      fuelType: 'PETROL',
      seats: 5,
      dailyPriceMinor,
      currency: 'RUB',
      depositMinor: BigInt(1000000),
      includedMileageKm: 300,
      overageMileagePriceMinor: BigInt(1000),
      missingFuelPriceMinor: BigInt(5000),
      registrationCertificateNumber: `DEMO-STS-${String(index + 1).padStart(2, '0')}`,
      vehiclePassportNumber: `DEMO-PTS-${String(index + 1).padStart(2, '0')}`,
      osagoInsurer: 'DEMO ONLY Insurance',
      osagoPolicyNumber: `DEMO-OSAGO-${String(index + 1).padStart(2, '0')}`,
      osagoStartsAt: new Date('2026-01-01'),
      osagoEndsAt: new Date('2030-12-31'),
      cascoInsurer: 'DEMO ONLY Insurance',
      cascoPolicyNumber: `DEMO-CASCO-${String(index + 1).padStart(2, '0')}`,
      cascoStartsAt: new Date('2026-01-01'),
      cascoEndsAt: new Date('2030-12-31'),
      originalPrice: 'Демо-тариф',
      features: ['Демо-автопарк'],
      status: 'AVAILABLE',
      isDemoImport: true,
      isRentalReady: true,
      rentalReadyAt: new Date(),
      archivedAt: null,
    };
    await database.vehicle.upsert({ where: { sourceKey }, create: data, update: data });
  }
  return { vehicles: approvedRentalFleet.length };
}
