import { z } from 'zod';

import { parseEventKey } from './event-key';

const MAX_ENTITY_ID_LENGTH = 128;

const entityIdSchema = z.string().trim().min(1).max(MAX_ENTITY_ID_LENGTH);

function optionalCoordinate(minimum: number, maximum: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().min(minimum).max(maximum).optional(),
  );
}

function requireBothCoordinates(
  value: { latitude?: number; longitude?: number },
  context: z.RefinementCtx,
) {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;

  if (hasLatitude === hasLongitude) {
    return;
  }

  context.addIssue({
    code: 'custom',
    path: [hasLatitude ? 'longitude' : 'latitude'],
    message: 'Координаты широты и долготы указываются вместе.',
  });
}

export const createManualEventSchema = z
  .object({
    vehicleId: entityIdSchema,
    kind: z.enum(['NOTE', 'INCIDENT', 'ASSIGNMENT']),
    severity: z.enum(['INFO', 'WARNING', 'DANGER']),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(240).optional(),
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
    recordedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine(requireBothCoordinates);

export const eventReadKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(191)
  .refine((key) => parseEventKey(key) !== null, 'Некорректный ключ события.');

export const eventReadKeysSchema = z.array(eventReadKeySchema).min(1).max(100);
