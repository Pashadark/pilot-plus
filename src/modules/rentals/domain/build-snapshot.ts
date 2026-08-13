type Input = {
  company: { id: string; legalName: string; inn: string; address: string };
  client: { id: string; fullName: string; phone: string; passport: string };
  vehicle: {
    id: string;
    make: string;
    model: string;
    registrationNumber: string;
    vin: string;
    dailyMinor: number;
    depositMinor: number;
  };
  rental: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    calculatedTotalMinor: number;
    agreedTotalMinor: number;
    currency: string;
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
      id: input.rental.id,
      startsAt: input.rental.startsAt.toISOString(),
      endsAt: input.rental.endsAt.toISOString(),
      calculatedTotalMinor: input.rental.calculatedTotalMinor,
      agreedTotalMinor: input.rental.agreedTotalMinor,
      currency: input.rental.currency,
    }),
  };
  return frozen(snapshot);
}
