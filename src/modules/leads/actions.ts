'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/database/prisma/client';
import { getClientAccess } from '@/modules/clients/access';
import { blindIndex, encryptField } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';

import type { LeadActionState } from './types';
import {
  buildLeadNotificationRows,
  type LeadNotificationEvent,
  type LeadNotificationRecipients,
} from './notification-jobs';
import { parseLeadInput, parseLeadStatus } from './validation';

function keys() {
  const encryptionKey = process.env.CLIENT_DATA_ENCRYPTION_KEY;
  const searchKey = process.env.CLIENT_SEARCH_KEY;
  if (!encryptionKey || !searchKey) throw new Error('Ключи защиты клиентских данных не настроены.');
  return { encryptionKey, searchKey };
}

async function resolveNotificationRecipients(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  companyId: string,
): Promise<LeadNotificationRecipients> {
  const binding = await transaction.telegramGroupBinding.findUnique({
    where: { companyId },
    select: { telegramChatId: true, boundByUserId: true },
  });
  if (!binding) return { groupChatId: null, personalIdentityId: null };

  const identity = await transaction.telegramIdentity.findFirst({
    where: {
      companyId,
      userId: binding.boundByUserId,
      kind: 'STAFF',
      isActive: true,
      user: { is: { isActive: true } },
    },
    select: { id: true },
  });

  return {
    groupChatId: binding.telegramChatId,
    personalIdentityId: identity?.id ?? null,
  };
}

async function enqueueLeadNotifications(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  event: LeadNotificationEvent,
) {
  const recipients = await resolveNotificationRecipients(transaction, event.companyId);
  const rows = buildLeadNotificationRows(event, recipients, new Date());
  if (rows.length) {
    await transaction.botNotificationJob.createMany({ data: rows, skipDuplicates: true });
  }
}

export async function createLeadAction(
  _previousState: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) return { status: 'error', message: 'Недостаточно прав.' };
  const parsed = parseLeadInput(formData);
  if (!parsed.ok) {
    return { status: 'error', message: 'Проверьте поля заявки.', fieldErrors: parsed.fieldErrors };
  }
  if (access.scope !== 'SYSTEM' && !access.companyIds.includes(parsed.data.companyId)) {
    return { status: 'error', message: 'Нет доступа к выбранной компании.' };
  }

  try {
    const { encryptionKey, searchKey } = keys();
    await prisma.$transaction(
      async (transaction) => {
        const lead = await transaction.lead.create({
          data: {
            companyId: parsed.data.companyId,
            name: parsed.data.name,
            lastName: parsed.data.lastName || null,
            phoneEncrypted: encryptField(parsed.data.phone, encryptionKey),
            phoneIndex: blindIndex(parsed.data.phone, searchKey, normalizeRussianPhone),
            source: parsed.data.source || null,
            commentEncrypted: parsed.data.comment
              ? encryptField(parsed.data.comment, encryptionKey)
              : null,
            nextContactAt: parsed.data.nextContactAt,
            createdByUserId: access.user.id,
            assignedToUserId: access.user.id,
          },
          select: { id: true, companyId: true },
        });
        const audit = await transaction.auditLog.create({
          data: {
            companyId: lead.companyId,
            actorUserId: access.user.id,
            actorEmailSnapshot: access.user.email,
            action: 'CREATE',
            entityType: 'SYSTEM',
            entityId: lead.id,
            entityLabel: 'LEAD',
            changes: {
              status: 'NEW',
              sourceProvided: Boolean(parsed.data.source),
              nextContactScheduled: Boolean(parsed.data.nextContactAt),
            },
          },
          select: { id: true },
        });
        await enqueueLeadNotifications(transaction, {
          companyId: lead.companyId,
          leadId: lead.id,
          auditId: audit.id,
          template: 'LEAD_CREATED',
        });
      },
      { isolationLevel: 'Serializable' },
    );
    revalidatePath('/leads');
    return { status: 'success', message: 'Заявка добавлена.' };
  } catch {
    return { status: 'error', message: 'Не удалось сохранить заявку.' };
  }
}

export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  const access = await getClientAccess('MANAGE_CLIENTS');
  if (!access) throw new Error('Недостаточно прав.');
  const leadId = formData.get('leadId');
  const status = parseLeadStatus(formData.get('status'));
  if (typeof leadId !== 'string' || !leadId || !status) throw new Error('Некорректные данные.');

  const changed = await prisma.$transaction(
    async (transaction) => {
      const lead = await transaction.lead.findFirst({
        where: {
          id: leadId,
          ...(access.scope === 'SYSTEM' ? {} : { companyId: { in: [...access.companyIds] } }),
        },
        select: { id: true, companyId: true, status: true },
      });
      if (!lead) throw new Error('Заявка не найдена.');
      if (lead.status === status) return false;

      const update = await transaction.lead.updateMany({
        where: { id: lead.id, companyId: lead.companyId, status: lead.status },
        data: { status },
      });
      if (update.count !== 1) throw new Error('Статус заявки уже изменился. Обновите страницу.');

      const audit = await transaction.auditLog.create({
        data: {
          companyId: lead.companyId,
          actorUserId: access.user.id,
          actorEmailSnapshot: access.user.email,
          action: 'UPDATE',
          entityType: 'SYSTEM',
          entityId: lead.id,
          entityLabel: 'LEAD',
          changes: { status: { from: lead.status, to: status } },
        },
        select: { id: true },
      });
      await enqueueLeadNotifications(transaction, {
        companyId: lead.companyId,
        leadId: lead.id,
        auditId: audit.id,
        template: 'LEAD_STATUS_CHANGED',
      });
      return true;
    },
    { isolationLevel: 'Serializable' },
  );
  if (changed) revalidatePath('/leads');
}
