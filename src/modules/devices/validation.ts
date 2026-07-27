import { z } from 'zod';

const MAX_ENTITY_ID_LENGTH = 128;
const NUMERIC_SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

const entityIdSchema = z.string().trim().min(1).max(MAX_ENTITY_ID_LENGTH);
const optionalEntityIdSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  entityIdSchema.nullable().optional(),
);
const numericSemverSchema = z.string().trim().regex(NUMERIC_SEMVER_PATTERN).max(64);

export const createDeviceSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    serialNumber: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{4,64}$/),
    imei: z
      .string()
      .trim()
      .regex(/^\d{15}$/),
    hardwareVersion: numericSemverSchema,
    firmwareVersion: numericSemverSchema,
    vehicleId: optionalEntityIdSchema,
  })
  .strict();

export const bindDeviceSchema = z
  .object({
    deviceId: entityIdSchema,
    vehicleId: optionalEntityIdSchema,
  })
  .strict();

const rebootCommandSchema = z
  .object({
    deviceId: entityIdSchema,
    type: z.literal('REBOOT'),
  })
  .strict();

const shutdownCommandSchema = z
  .object({
    deviceId: entityIdSchema,
    type: z.literal('SHUTDOWN'),
  })
  .strict();

const updateFirmwareCommandSchema = z
  .object({
    deviceId: entityIdSchema,
    type: z.literal('UPDATE_FIRMWARE'),
    firmwareReleaseId: entityIdSchema,
  })
  .strict();

export const createDeviceCommandSchema = z.discriminatedUnion('type', [
  rebootCommandSchema,
  shutdownCommandSchema,
  updateFirmwareCommandSchema,
]);

export const cancelDeviceCommandSchema = z
  .object({
    commandId: entityIdSchema,
  })
  .strict();
