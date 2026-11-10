'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { canManageRentalRegionalGeofence, getRentalAccess } from '@/modules/rentals/server/access';

const inputSchema = z
  .object({
    rentalId: z.string().trim().min(1).max(191),
    enabled: z.boolean(),
    regionCodes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^RU-[A-Z0-9]{2,3}$/u),
      )
      .min(1)
      .max(100),
    warningDistanceKm: z.number().int().min(2).max(100),
    attentionDistanceKm: z.number().int().min(1).max(50),
    criticalDistanceKm: z.number().int().min(1).max(10),
  })
  .refine(
    (value) =>
      value.warningDistanceKm > value.attentionDistanceKm &&
      value.attentionDistanceKm > value.criticalDistanceKm,
    { message: 'Пороги должны убывать: ранний, повышенный, критический.' },
  );

export type SaveRegionalGeofenceResult =
  { ok: true; version: number } | { ok: false; message: string };

export async function saveRentalRegionalGeofence(
  rawInput: unknown,
): Promise<SaveRegionalGeofenceResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Ошибка.' };
  const input = { ...parsed.data, regionCodes: [...new Set(parsed.data.regionCodes)].sort() };
  const access = await getRentalAccess();
  if (!access) return { ok: false, message: 'Недостаточно прав для изменения геозоны.' };
  const rental = await prisma.rental.findUnique({
    where: { id: input.rentalId },
    select: { id: true, companyId: true, contractNumber: true },
  });
  if (!rental || !canManageRentalRegionalGeofence(access, rental.companyId)) {
    return { ok: false, message: 'Аренда не найдена или недоступна.' };
  }
  const regions = await prisma.russianRegion.findMany({
    where: { code: { in: input.regionCodes } },
    select: { code: true, nameRu: true },
  });
  if (regions.length !== input.regionCodes.length) {
    return { ok: false, message: 'Один или несколько регионов отсутствуют в справочнике.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.rentalRegionalGeofence.findUnique({
      where: { rentalId: rental.id },
      select: {
        id: true,
        version: true,
        enabled: true,
        regionCodes: true,
        warningDistanceKm: true,
        attentionDistanceKm: true,
        criticalDistanceKm: true,
      },
    });
    const version = (previous?.version ?? 0) + 1;
    const row = await tx.rentalRegionalGeofence.upsert({
      where: { rentalId: rental.id },
      create: {
        companyId: rental.companyId,
        rentalId: rental.id,
        enabled: input.enabled,
        version,
        regionCodes: input.regionCodes,
        warningDistanceKm: input.warningDistanceKm,
        attentionDistanceKm: input.attentionDistanceKm,
        criticalDistanceKm: input.criticalDistanceKm,
        updatedByUserId: access.user.id,
      },
      update: {
        enabled: input.enabled,
        version,
        regionCodes: input.regionCodes,
        warningDistanceKm: input.warningDistanceKm,
        attentionDistanceKm: input.attentionDistanceKm,
        criticalDistanceKm: input.criticalDistanceKm,
        state: 'INSIDE',
        pendingTransition: null,
        pendingCount: 0,
        pendingSince: null,
        outsideSince: null,
        lastEvaluatedAt: null,
        lastDistanceKm: null,
        lastApproachThresholdKm: null,
        updatedByUserId: access.user.id,
      },
      select: { id: true },
    });
    const codes = Prisma.join(input.regionCodes.map((code) => Prisma.sql`${code}`));
    await tx.$executeRaw(Prisma.sql`
      UPDATE "RentalRegionalGeofence"
      SET "regionUnion" = (
        SELECT ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_Collect("boundary")), 3))
        FROM "RussianRegion"
        WHERE "code" IN (${codes}) AND "boundary" IS NOT NULL
      ), "updatedAt" = NOW()
      WHERE "id" = ${row.id}
    `);
    const geometry = await tx.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT COALESCE(ST_IsValid("regionUnion"), false) AS "valid"
      FROM "RentalRegionalGeofence" WHERE "id" = ${row.id}
    `);
    if (!geometry[0]?.valid) throw new Error('Не удалось построить разрешённую территорию.');
    await tx.auditLog.create({
      data: {
        companyId: rental.companyId,
        actorUserId: access.user.id,
        actorEmailSnapshot: access.user.email,
        action: previous ? 'UPDATE' : 'CREATE',
        entityType: 'RENTAL',
        entityId: rental.id,
        entityLabel: rental.contractNumber ?? rental.id,
        changes: {
          regionalGeofence: {
            version,
            old: previous
              ? {
                  enabled: previous.enabled,
                  regionCodes: previous.regionCodes,
                  thresholdsKm: [
                    previous.warningDistanceKm,
                    previous.attentionDistanceKm,
                    previous.criticalDistanceKm,
                  ],
                }
              : null,
            next: {
              enabled: input.enabled,
              regionCodes: input.regionCodes,
              thresholdsKm: [
                input.warningDistanceKm,
                input.attentionDistanceKm,
                input.criticalDistanceKm,
              ],
            },
          },
        },
      },
    });
    return { version };
  });
  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath('/map');
  return { ok: true, version: result.version };
}
