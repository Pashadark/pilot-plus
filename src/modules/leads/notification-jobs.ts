import type { Prisma } from '@/database/generated/prisma';

export type LeadNotificationEvent = {
  companyId: string;
  leadId: string;
  auditId: string;
  template: 'LEAD_CREATED' | 'LEAD_STATUS_CHANGED';
};

export type LeadNotificationRecipients = {
  groupChatId: string | null;
  personalIdentityId: string | null;
};

function eventPrefix(event: LeadNotificationEvent) {
  return event.template === 'LEAD_CREATED'
    ? `lead-created:${event.leadId}`
    : `lead-status:${event.auditId}`;
}

export function buildLeadNotificationRows(
  event: LeadNotificationEvent,
  recipients: LeadNotificationRecipients,
  now: Date,
): Prisma.BotNotificationJobCreateManyInput[] {
  const common = {
    companyId: event.companyId,
    template: event.template,
    payload: { leadId: event.leadId, auditId: event.auditId },
    availableAt: now,
  } satisfies Omit<Prisma.BotNotificationJobCreateManyInput, 'eventKey'>;
  const prefix = eventPrefix(event);
  const rows: Prisma.BotNotificationJobCreateManyInput[] = [];

  if (recipients.groupChatId) {
    rows.push({
      ...common,
      chatId: recipients.groupChatId,
      eventKey: `${prefix}:group`,
    });
  }

  return rows;
}
