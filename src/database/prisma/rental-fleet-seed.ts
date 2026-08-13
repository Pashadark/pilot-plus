const prefix = 'example-fleet:';
export const approvedRentalFleet = [
  ['kia-ceed-2020', 'Kia', "Cee'd", 'А429АУ97', 2020, 350000],
  ['skoda-octavia-2019', 'Skoda', 'Octavia', 'Е435АН997', 2019, 420000],
  ['mercedes-e220d-2019', 'Mercedes-Benz', 'E 220 d 4MATIC', 'М283АМ997', 2019, 850000],
  ['volkswagen-polo-2020', 'Volkswagen', 'Polo', 'А156АХ997', 2020, 470000],
] as const;
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
    key,
    make,
    modelName,
    registrationNumber,
    manufacturedYear,
    dailyPriceMinor,
  ] of approvedRentalFleet) {
    const sourceKey = `${prefix}${key}`;
    const data = {
      companyId,
      sourceKey,
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
      originalPrice: 'Демо-тариф',
      features: ['Демо-автопарк'],
      status: 'AVAILABLE',
      isDemoImport: true,
      isRentalReady: true,
      rentalReadyAt: new Date(),
      archivedAt: null,
      ...(key === 'volkswagen-polo-2020'
        ? {
            registrationCertificateNumber: 'ДЕМО-СТС-POLO',
            vehiclePassportNumber: 'ДЕМО-ПТС-POLO',
            osagoInsurer: 'Демо-страхование',
            osagoPolicyNumber: 'ДЕМО-ОСАГО-POLO',
            osagoStartsAt: new Date('2026-01-01'),
            osagoEndsAt: new Date('2027-01-01'),
          }
        : {}),
    };
    await database.vehicle.upsert({ where: { sourceKey }, create: data, update: data });
  }
  return { vehicles: approvedRentalFleet.length };
}
