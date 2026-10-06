import type { PrismaClient } from '@/database/generated/prisma';
import { record } from './message';

export type AvitoControl = { enabled: boolean; enabledAt: string | null; updatedAt: string | null };
export function decodeControl(value: unknown): AvitoControl {
  const v = record(value);
  const valid = (d: unknown): d is string =>
    typeof d === 'string' && Number.isFinite(Date.parse(d));
  const enabled = v.enabled === true && valid(v.enabledAt) && valid(v.updatedAt);
  return {
    enabled,
    enabledAt: enabled ? String(v.enabledAt) : null,
    updatedAt: valid(v.updatedAt) ? v.updatedAt : null,
  };
}
export async function readAvitoControl(
  companyId: string,
  db: Pick<PrismaClient, 'auditLog'>,
): Promise<AvitoControl> {
  const event = await db.auditLog.findFirst({
    where: {
      companyId,
      entityType: 'SYSTEM',
      entityId: `avito-autoreply:${companyId}`,
      action: 'UPDATE',
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { changes: true },
  });
  return decodeControl(event?.changes);
}
export async function setAvitoControl(
  userId: string,
  companyId: string,
  enabled: boolean,
  db: Pick<PrismaClient, '$transaction'>,
) {
  if (typeof enabled !== 'boolean') throw Error('INVALID_REQUEST');
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avito-control:${companyId}`}))`;
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          isActive: true,
          role: 'SUPER_ADMIN',
          memberships: { some: { companyId } },
        },
        select: { id: true, email: true },
      });
      if (!user) throw Error('FORBIDDEN');
      const binding = await tx.telegramGroupBinding.findFirst({
        where: { companyId, boundByUserId: userId },
        select: { companyId: true },
      });
      const connected = await tx.avitoDialogue.findFirst({
        where: { companyId },
        select: { id: true },
      });
      if (!binding || !connected) throw Error('FORBIDDEN');
      const now = new Date();
      const state: AvitoControl = {
        enabled,
        enabledAt: enabled ? now.toISOString() : null,
        updatedAt: now.toISOString(),
      };
      await tx.avitoOutgoing.updateMany({
        where: { companyId, state: 'PENDING' },
        data: { state: 'CANCELLED', errorCode: 'OWNER_CONTROL_CHANGED' },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorUserId: user.id,
          actorEmailSnapshot: user.email,
          action: 'UPDATE',
          entityType: 'SYSTEM',
          entityId: `avito-autoreply:${companyId}`,
          entityLabel: 'Автоответчик Авито',
          changes: state,
          createdAt: now,
        },
      });
      return state;
    },
    { timeout: 15000 },
  );
}
