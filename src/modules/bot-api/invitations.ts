import { createHash } from 'node:crypto';

import { prisma } from '@/database/prisma/client';

import { BotApiError } from './auth';
import type { BotProfile, LinkIdentityInput } from './contracts';

const REDACTED_ACTOR = 'redacted@audit.invalid';

export async function linkTelegramIdentity(
  input: LinkIdentityInput,
  database: Pick<typeof prisma, '$transaction'> = prisma,
): Promise<BotProfile> {
  const tokenHash = createHash('sha256').update(input.inviteToken, 'utf8').digest('hex');
  const now = new Date();

  return database.$transaction(
    async (tx) => {
      const invite = await tx.telegramInvite.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        select: { id: true, companyId: true, kind: true, targetId: true, createdByUserId: true },
      });
      if (!invite) throw new BotApiError('INVITE_INVALID', 400);

      let displayName: string;
      let clientId: string | null = null;
      let userId: string | null = null;
      if (invite.kind === 'CLIENT') {
        const client = await tx.client.findFirst({
          where: { id: invite.targetId, companyId: invite.companyId, archivedAt: null },
          select: { id: true, firstName: true, lastName: true, status: true },
        });
        if (!client || client.status === 'BLOCKED' || client.status === 'ARCHIVED') {
          throw new BotApiError('INVITE_INVALID', 400);
        }
        clientId = client.id;
        displayName = `${client.firstName} ${client.lastName}`.trim();
      } else {
        const member = await tx.companyMember.findFirst({
          where: {
            companyId: invite.companyId,
            userId: invite.targetId,
            user: { isActive: true },
          },
          select: { userId: true, user: { select: { name: true } } },
        });
        if (!member) throw new BotApiError('INVITE_INVALID', 400);
        userId = member.userId;
        displayName = member.user.name;
      }

      const existing = await tx.telegramIdentity.findFirst({
        where: {
          companyId: invite.companyId,
          OR: [
            { telegramUserId: input.telegramUserId },
            ...(clientId ? [{ clientId }] : []),
            ...(userId ? [{ userId }] : []),
          ],
        },
        select: { telegramUserId: true, clientId: true, userId: true, kind: true, isActive: true },
      });
      if (
        existing &&
        (existing.telegramUserId !== input.telegramUserId ||
          existing.clientId !== clientId ||
          existing.userId !== userId ||
          existing.kind !== invite.kind)
      ) {
        throw new BotApiError('IDENTITY_CONFLICT', 409);
      }

      if (!existing) {
        await tx.telegramIdentity.create({
          data: {
            companyId: invite.companyId,
            telegramUserId: input.telegramUserId,
            kind: invite.kind,
            clientId,
            userId,
          },
        });
      } else if (!existing.isActive) {
        throw new BotApiError('IDENTITY_DISABLED', 403);
      }

      const consumed = await tx.telegramInvite.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw new BotApiError('INVITE_INVALID', 400);

      await tx.auditLog.create({
        data: {
          companyId: invite.companyId,
          actorUserId: invite.createdByUserId,
          actorEmailSnapshot: REDACTED_ACTOR,
          action: 'ASSIGN',
          entityType: 'SYSTEM',
          entityLabel: 'TELEGRAM_IDENTITY',
          changes: { kind: invite.kind },
        },
      });

      return { kind: invite.kind, companyId: invite.companyId, clientId, userId, displayName };
    },
    { isolationLevel: 'Serializable' },
  );
}
