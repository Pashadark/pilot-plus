import { z } from 'zod';
import { parsePilotDateTimeLocal } from '@/shared/business-time';
import { driverHelperMoneyToMinor, paginatedSchema } from './integrations/driver-helper/schemas';

export const tollTripSchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
  road: z.string().min(1),
  place: z.string().nullish(),
  amount: z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)]),
  travelDate: z.string(),
  lastCheckDate: z.string().nullish(),
  carId: z.union([z.number(), z.string()]),
  carRegnum: z.string(),
  carTitle: z.string().default(''),
  uin: z.string().nullish(),
});
export const tollPageSchema = paginatedSchema(tollTripSchema);
export type TollTrip = z.infer<typeof tollTripSchema>;
export interface TollVehicle {
  id: string;
  companyId: string;
  registrationNumber: string | null;
}
export interface TollRental {
  id: string;
  companyId: string;
  vehicleId: string;
  clientId: string;
  contractNumber: string | null;
  startsAt: Date;
  endsAt: Date;
  activatedAt?: Date | null;
  completedAt?: Date | null;
  client: { lastName: string; firstName: string; middleName: string | null };
}

export function parseTollDate(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}):(\d{2})$/.exec(value);
  if (!m || Number(m[3]) > 59) return null;
  const date = parsePilotDateTimeLocal(`${m[1]}T${m[2]}`);
  return date ? new Date(date.getTime() + Number(m[3]) * 1000) : null;
}
const latin = 'ABEKMHOPCTYX';
const cyrillic = 'АВЕКМНОРСТУХ';
export function tollPlate(value: string | null) {
  return (value ?? '')
    .toUpperCase()
    .replace(/[ABEKMHOPCTYX]/g, (c) => cyrillic[latin.indexOf(c)])
    .replace(/[^А-Я0-9]/g, '');
}

export function mapTollDebt(
  companyId: string,
  input: TollTrip,
  vehicles: readonly TollVehicle[],
  rentals: readonly TollRental[],
) {
  const parsed = tollTripSchema.safeParse(input);
  if (!parsed.success) return null;
  const trip = parsed.data;
  const at = parseTollDate(trip.travelDate);
  if (!at) return null;
  const matches = vehicles.filter(
    (v) =>
      v.companyId === companyId && tollPlate(v.registrationNumber) === tollPlate(trip.carRegnum),
  );
  const vehicle = matches.length === 1 ? matches[0] : null;
  const candidates = vehicle
    ? rentals.filter(
        (r) =>
          r.companyId === companyId &&
          r.vehicleId === vehicle.id &&
          (r.activatedAt ?? r.startsAt) <= at &&
          at < (r.completedAt ?? r.endsAt),
      )
    : [];
  const rental = candidates.length === 1 ? candidates[0] : null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(trip.amount))) return null;
  const amount = driverHelperMoneyToMinor(String(trip.amount));
  if (BigInt(amount) <= BigInt(0)) return null;
  const roadLabel =
    (
      { ckad: 'ЦКАД / Автодор', msd: 'МСД', sdkp: 'СДКП', vis: 'Платная дорога VIS' } as Record<
        string,
        string
      >
    )[trip.road.toLowerCase()] ?? trip.road;
  return {
    id: `toll:${companyId}:${trip.id}`,
    companyId,
    kind: 'TOLL' as const,
    roadLabel,
    offenseAt: at.toISOString(),
    decreeNumber: '',
    currentAmountMinor: amount,
    originalAmountMinor: amount,
    status: 'UNPAID' as const,
    description: trip.place || 'Проезд по платной дороге',
    address: trip.place ?? null,
    vehicleId: vehicle?.id ?? null,
    clientId: rental?.clientId ?? null,
    rentalId: rental?.id ?? null,
    vehicleLabel: [trip.carTitle, trip.carRegnum].filter(Boolean).join(' · '),
    clientLabel: rental
      ? [rental.client.lastName, rental.client.firstName, rental.client.middleName]
          .filter(Boolean)
          .join(' ')
      : null,
    rentalLabel: rental?.contractNumber ?? null,
    assigned: Boolean(rental),
    photoAvailable: false,
    discountExpiresAt: null,
    checkedAt: trip.lastCheckDate
      ? (parseTollDate(trip.lastCheckDate)?.toISOString() ?? null)
      : null,
  };
}
