const customerTemplates = new Set([
  'RENTAL_RETURN_CLIENT',
  'CLIENT_RENTAL_LIFECYCLE',
  'CLIENT_IMPOUND_ALERT',
  'CLIENT_GPS_EVENT',
]);
const internalTemplates = new Set([
  'CLIENT_SUPPORT_REQUEST',
  'DAILY_OPERATIONS_DIGEST',
  'DAILY_UNPAID_FINES',
  'LEASE_TO_OWN_WEEKLY_INSPECTION',
  'OPERATIONAL_ALERT',
  'RENTAL_RETURN_STAFF',
  'RENTAL_LIFECYCLE',
  'LEAD_CREATED',
  'LEAD_STATUS_CHANGED',
  'BOT_RENTAL_REQUEST_CREATED',
  'AVITO_READY',
  'AVITO_WAITING',
  'DEPOSIT_RETURNED',
  'SYSTEM_BILLING_ALERT',
]);

export function notificationDestination(
  job: {
    companyId: string;
    template: string;
    chatId: string | null;
    identity: {
      kind: string;
      companyId: string;
      clientId: string | null;
      isActive: boolean;
      telegramUserId: string;
    } | null;
  },
  boundGroup: string | null,
): string | null {
  if (customerTemplates.has(job.template)) {
    const identity = job.identity;
    return !job.chatId &&
      identity?.isActive &&
      identity.kind === 'CLIENT' &&
      identity.companyId === job.companyId &&
      identity.clientId &&
      /^[1-9]\d{0,19}$/u.test(identity.telegramUserId)
      ? identity.telegramUserId
      : null;
  }
  if (
    !internalTemplates.has(job.template) ||
    job.identity ||
    !boundGroup ||
    !/^-[1-9]\d{0,19}$/u.test(boundGroup)
  )
    return null;
  return job.chatId === boundGroup || job.chatId === `staff:${job.companyId}` ? boundGroup : null;
}
