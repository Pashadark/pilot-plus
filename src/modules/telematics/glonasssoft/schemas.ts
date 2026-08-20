import { z } from 'zod';

const finiteNumber = z.number().finite();
const identifier = z.union([z.string().trim().min(1).max(128), z.number().int().nonnegative()]);
const isoDate = z.string().datetime({ offset: true });

export const authResponseSchema = z
  .union([
    z.string().trim().min(1).max(4096),
    z.object({ token: z.string().trim().min(1).max(4096) }).passthrough(),
    z.object({ authId: z.string().trim().min(1).max(4096) }).passthrough(),
    z.object({ AuthId: z.string().trim().min(1).max(4096) }).passthrough(),
  ])
  .transform<string>((value) => {
    if (typeof value === 'string') return value;
    if ('token' in value && typeof value.token === 'string') return value.token;
    if ('authId' in value && typeof value.authId === 'string') return value.authId;
    if ('AuthId' in value && typeof value.AuthId === 'string') return value.AuthId;
    throw new Error('Invalid auth response');
  });

export const vehicleSchema = z
  .object({
    vehicleId: identifier,
    name: z.string().trim().min(1).max(500),
  })
  .passthrough()
  .transform((value) => ({ externalId: String(value.vehicleId), name: value.name }));

export const vehiclesSchema = z.array(vehicleSchema).max(10_000);

export const lastDataSchema = z
  .object({
    vehicleId: identifier,
    receiveTime: isoDate,
    recordTime: isoDate,
    state: z.number().int().min(0).max(4),
    lat: finiteNumber.optional(),
    latitude: finiteNumber.optional(),
    lon: finiteNumber.optional(),
    longitude: finiteNumber.optional(),
    speed: finiteNumber.nonnegative().optional(),
    mileage: finiteNumber.nonnegative().optional(),
    fuel: finiteNumber.min(0).max(100).optional(),
    address: z.string().trim().max(1000).optional().nullable(),
  })
  .passthrough()
  .transform((value, context) => {
    const latitude = value.lat ?? value.latitude;
    const longitude = value.lon ?? value.longitude;
    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid coordinates' });
      return z.NEVER;
    }
    return {
      externalId: String(value.vehicleId),
      receivedAt: value.receiveTime,
      recordedAt: value.recordTime,
      state: value.state,
      latitude,
      longitude,
      speedKph: value.speed ?? 0,
      odometerKm: value.mileage ?? null,
      fuelPercent: value.fuel ?? null,
      address: value.address || null,
    };
  });

export const lastDataListSchema = z.array(lastDataSchema).max(10_000);

export const terminalMessageSchema = z
  .object({
    id: identifier.optional(),
    messageId: identifier.optional(),
    recordTime: isoDate,
    lat: finiteNumber,
    lon: finiteNumber,
    speed: finiteNumber.nonnegative().optional(),
    mileage: finiteNumber.nonnegative().optional(),
  })
  .passthrough()
  .transform((value) => ({
    externalId: String(value.messageId ?? value.id ?? value.recordTime),
    recordedAt: value.recordTime,
    latitude: value.lat,
    longitude: value.lon,
    speedKph: value.speed ?? 0,
    odometerKm: value.mileage ?? null,
  }));

export const terminalMessagesSchema = z.array(terminalMessageSchema).max(100_000);
export const mileageSchema = z.array(z.record(z.string(), z.unknown())).max(10_000);

export type GlonassSoftVehicle = z.output<typeof vehicleSchema>;
export type GlonassSoftLastData = z.output<typeof lastDataSchema>;
export type GlonassSoftMessage = z.output<typeof terminalMessageSchema>;
