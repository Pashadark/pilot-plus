type Input = {
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
export function buildRentalSnapshot(input: Input) {
  money(input.vehicle.dailyMinor);
  money(input.vehicle.depositMinor);
  money(input.rental.calculatedTotalMinor);
  money(input.rental.agreedTotalMinor);
  const snapshot = {
    schemaVersion: 1 as const,
    company: frozen({ ...input.company }),
    client: frozen({ ...input.client }),
    vehicle: frozen({ ...input.vehicle }),
    rental: frozen({
      ...input.rental,
      startsAt: input.rental.startsAt.toISOString(),
      endsAt: input.rental.endsAt.toISOString(),
      createdAt: input.rental.createdAt?.toISOString(),
    }),
  };
  return frozen(snapshot);
}
