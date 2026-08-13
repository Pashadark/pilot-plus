type Input = {
  confirmedReady?: boolean;
  company: {
    id: string;
    legalName: string;
    inn: string;
    address: string;
    kpp?: string;
    ogrn?: string;
    actualAddress?: string;
    phone?: string;
    email?: string;
    bankName?: string;
    settlementAccount?: string;
    correspondentAccount?: string;
    bik?: string;
    signatoryName?: string;
    signatoryBasis?: string;
    contractCity?: string;
  };
  client: {
    id: string;
    fullName: string;
    phone: string;
    passport: string;
    birthDate?: string;
    registrationAddress?: string;
    residentialAddress?: string;
    licenseNumber?: string;
    licenseIssuedAt?: string;
    licenseExpiresAt?: string;
  };
  vehicle: {
    id: string;
    make: string;
    model: string;
    registrationNumber: string;
    vin: string;
    dailyMinor: number;
    depositMinor: number;
    registrationCertificateNumber?: string;
    vehiclePassportNumber?: string;
    osagoInsurer?: string;
    osagoPolicyNumber?: string;
    osagoStartsAt?: string;
    osagoEndsAt?: string;
    cascoInsurer?: string;
    cascoPolicyNumber?: string;
    cascoStartsAt?: string;
    cascoEndsAt?: string;
    year?: number;
    color?: string;
    bodyType?: string;
    transmission?: string;
    fuelType?: string;
    seats?: number;
    includedMileageKm?: number;
    overageMileagePriceMinor?: number;
    missingFuelPriceMinor?: number;
  };
  rental: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    calculatedTotalMinor: number;
    agreedTotalMinor: number;
    currency: string;
    days?: number;
    discountMinor?: number;
    servicesMinor?: number;
    depositMinor?: number;
    pickupAddress?: string;
    returnAddress?: string;
    conditions?: string;
    createdByUserId?: string;
    createdAt?: Date;
  };
};
function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('Деньги должны быть безопасным целым числом.');
  return value;
}
function frozen<T>(value: T): T {
  return Object.freeze(value);
}
function nullable<T extends Record<string, unknown>>(value: T, keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, value[key] ?? null]));
}
export function buildRentalSnapshot(input: Input) {
  money(input.vehicle.dailyMinor);
  money(input.vehicle.depositMinor);
  money(input.rental.calculatedTotalMinor);
  money(input.rental.agreedTotalMinor);
  for (const [key, value] of Object.entries(input.rental))
    if (key.endsWith('Minor') && typeof value === 'number') money(value);
  for (const [key, value] of Object.entries(input.vehicle))
    if (key.endsWith('Minor') && typeof value === 'number') money(value);
  const mandatory = [
    input.company.legalName,
    input.company.inn,
    input.company.address,
    input.company.signatoryName,
    input.company.signatoryBasis,
    input.company.contractCity,
    input.client.fullName,
    input.client.passport,
    input.client.birthDate,
    input.client.registrationAddress,
    input.client.licenseNumber,
    input.vehicle.registrationNumber,
  ];
  const warnings = mandatory
    .map((value, index) => (value ? null : `MISSING_${index}`))
    .filter((value): value is string => value !== null);
  if (input.confirmedReady && warnings.length > 0)
    throw new Error('Для подтверждения отсутствуют обязательные юридические данные.');
  const snapshot = {
    schemaVersion: 1 as const,
    completeness: frozen({ confirmedReady: Boolean(input.confirmedReady), warnings }),
    company: frozen(
      nullable(input.company, [
        'id',
        'legalName',
        'inn',
        'kpp',
        'ogrn',
        'address',
        'actualAddress',
        'phone',
        'email',
        'bankName',
        'settlementAccount',
        'correspondentAccount',
        'bik',
        'signatoryName',
        'signatoryBasis',
        'contractCity',
        'pickupAddress',
        'returnAddress',
      ]),
    ),
    client: frozen(
      nullable(input.client, [
        'id',
        'fullName',
        'phone',
        'passport',
        'birthDate',
        'registrationAddress',
        'residentialAddress',
        'licenseNumber',
        'licenseIssuedAt',
        'licenseExpiresAt',
      ]),
    ),
    vehicle: frozen(
      nullable(input.vehicle, [
        'id',
        'make',
        'model',
        'registrationNumber',
        'vin',
        'dailyMinor',
        'depositMinor',
        'registrationCertificateNumber',
        'vehiclePassportNumber',
        'osagoInsurer',
        'osagoPolicyNumber',
        'osagoStartsAt',
        'osagoEndsAt',
        'cascoInsurer',
        'cascoPolicyNumber',
        'cascoStartsAt',
        'cascoEndsAt',
        'year',
        'color',
        'bodyType',
        'transmission',
        'fuelType',
        'seats',
        'includedMileageKm',
        'overageMileagePriceMinor',
        'missingFuelPriceMinor',
      ]),
    ),
    rental: frozen({
      ...nullable(input.rental, [
        'id',
        'calculatedTotalMinor',
        'agreedTotalMinor',
        'currency',
        'days',
        'discountMinor',
        'servicesMinor',
        'depositMinor',
        'pickupAddress',
        'returnAddress',
        'conditions',
        'createdByUserId',
      ]),
      startsAt: input.rental.startsAt.toISOString(),
      endsAt: input.rental.endsAt.toISOString(),
      createdAt: input.rental.createdAt?.toISOString(),
    }),
  };
  return frozen(snapshot);
}
