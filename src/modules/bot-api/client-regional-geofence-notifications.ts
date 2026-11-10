export type ClientRegionalGeofenceAlertStage = 'IMMEDIATE' | 'ONE_HOUR';

export interface ClientRegionalGeofenceNotificationRepository {
  telegramIdentity: {
    findUnique(args: unknown): Promise<{ id: string; isActive: boolean } | null>;
  };
  botNotificationJob: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatClientRegionalGeofenceMessage(input: {
  stage: ClientRegionalGeofenceAlertStage;
  vehicle: string;
  registrationNumber: string | null;
}) {
  const vehicle = `${escapeHtml(input.vehicle)} · <code>${escapeHtml(input.registrationNumber ?? 'без номера')}</code>`;
  if (input.stage === 'ONE_HOUR') {
    return [
      '⛔ <b>Автомобиль всё ещё вне разрешённой территории</b>',
      '',
      '🚗 <b>Авто</b>',
      `└ ${vehicle}`,
      '',
      '⏱ <b>Прошёл 1 час</b>',
      '└ Автомобиль не вернулся в разрешённую геозону.',
      '',
      '⚠️ <b>Важно</b>',
      '└ Возможна дистанционная блокировка автомобиля.',
      '',
      '⚡ <b>Действие</b>',
      '└ Срочно вернитесь в разрешённую территорию или свяжитесь с менеджером.',
    ].join('\n');
  }
  return [
    '🚨 <b>Выезд за разрешённую территорию</b>',
    '',
    '🚗 <b>Авто</b>',
    `└ ${vehicle}`,
    '',
    '📍 <b>Геозона</b>',
    '└ Вы выехали за пределы разрешённой территории.',
    '',
    '⚠️ <b>Важно</b>',
    '└ Автомобиль может быть дистанционно заблокирован.',
    '',
    '⚡ <b>Действие</b>',
    '└ Вернитесь в разрешённую территорию или свяжитесь с менеджером.',
  ].join('\n');
}

export async function queueClientRegionalGeofenceNotifications(input: {
  companyId: string;
  vehicleId: string;
  rentalId: string;
  clientId: string;
  eventId: string;
  geofenceVersion: number;
  recordedAt: Date;
  prisma: ClientRegionalGeofenceNotificationRepository;
}) {
  const identity = await input.prisma.telegramIdentity.findUnique({
    where: {
      companyId_clientId: { companyId: input.companyId, clientId: input.clientId },
    },
    select: { id: true, isActive: true },
  });
  if (!identity?.isActive) return { immediateQueued: false, reminderQueued: false };

  const payload = {
    vehicleId: input.vehicleId,
    rentalId: input.rentalId,
    clientId: input.clientId,
    eventId: input.eventId,
    geofenceVersion: input.geofenceVersion,
  };
  const result = await input.prisma.botNotificationJob.createMany({
    data: [
      {
        companyId: input.companyId,
        identityId: identity.id,
        chatId: null,
        eventKey: `regional-geofence:client:${input.eventId}:immediate`,
        template: 'CLIENT_REGIONAL_GEOFENCE_ALERT',
        payload: { ...payload, stage: 'IMMEDIATE' },
        availableAt: input.recordedAt,
      },
      {
        companyId: input.companyId,
        identityId: identity.id,
        chatId: null,
        eventKey: `regional-geofence:client:${input.eventId}:one-hour`,
        template: 'CLIENT_REGIONAL_GEOFENCE_ALERT',
        payload: { ...payload, stage: 'ONE_HOUR' },
        availableAt: new Date(input.recordedAt.getTime() + 60 * 60_000),
      },
    ],
    skipDuplicates: true,
  });
  return {
    immediateQueued: result.count > 0,
    reminderQueued: result.count > 1,
  };
}
