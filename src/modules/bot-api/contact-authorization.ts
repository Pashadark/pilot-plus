import { prisma } from '@/database/prisma/client';
import { blindIndex } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';
import { BotApiError } from './auth';
import type { BotProfile } from './contracts';

export async function linkClientContact(
  input: { telegramUserId: string; contactUserId?: string; phoneNumber?: string },
  database: Pick<typeof prisma, '$transaction'> = prisma,
): Promise<BotProfile> {
  if (!input.phoneNumber || !input.contactUserId) throw new BotApiError('CONTACT_REQUIRED', 400);
  if (
    input.contactUserId !== input.telegramUserId ||
    !/^[1-9]\d{0,19}$/u.test(input.telegramUserId)
  )
    throw new BotApiError('CONTACT_MISMATCH', 403);
  const phone = normalizeRussianPhone(input.phoneNumber);
  if (!/^\d{7,15}$/u.test(phone)) throw new BotApiError('CONTACT_MISMATCH', 403);
  const key = process.env.CLIENT_SEARCH_KEY;
  if (!key) throw new BotApiError('SERVICE_UNAVAILABLE', 503);
  return database.$transaction(
    async (tx) => {
      const clients = await tx.client.findMany({
        where: {
          phoneIndex: blindIndex(phone, key, normalizeRussianPhone),
          archivedAt: null,
          status: { notIn: ['BLOCKED', 'ARCHIVED'] },
          rentals: { some: { status: { in: ['CONFIRMED', 'ACTIVE'] } } },
        },
        select: {
          id: true,
          companyId: true,
          firstName: true,
          lastName: true,
          createdByUserId: true,
        },
        take: 2,
      });
      if (clients.length !== 1) throw new BotApiError('MANAGER_REVIEW_REQUIRED', 409);
      const client = clients[0];
      const identities = await tx.telegramIdentity.findMany({
        take: 2,
        where: {
          OR: [
            { telegramUserId: input.telegramUserId },
            { companyId: client.companyId, clientId: client.id },
          ],
        },
      });
      if (identities.length > 1) throw new BotApiError('MANAGER_REVIEW_REQUIRED', 409);
      const existing = identities[0];
      if (
        existing &&
        (!existing.isActive ||
          existing.companyId !== client.companyId ||
          existing.clientId !== client.id ||
          existing.kind !== 'CLIENT' ||
          existing.telegramUserId !== input.telegramUserId)
      ) {
        throw new BotApiError('MANAGER_REVIEW_REQUIRED', 409);
      }
      if (!existing) {
        await tx.telegramIdentity.create({
          data: {
            companyId: client.companyId,
            clientId: client.id,
            telegramUserId: input.telegramUserId,
            kind: 'CLIENT',
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: client.companyId,
            actorUserId: null,
            actorEmailSnapshot: 'telegram-client@audit.invalid',
            action: 'ASSIGN',
            entityType: 'SYSTEM',
            entityLabel: 'TELEGRAM_CONTACT_VERIFIED',
            changes: { clientId: client.id, method: 'OWN_TELEGRAM_CONTACT' },
          },
        });
      }
      return {
        kind: 'CLIENT',
        companyId: client.companyId,
        clientId: client.id,
        userId: null,
        displayName: `${client.firstName} ${client.lastName}`.trim(),
      };
    },
    { isolationLevel: 'Serializable' },
  );
}
