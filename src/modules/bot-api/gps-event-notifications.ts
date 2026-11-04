import type { GpsNotificationMode } from '@/modules/telematics/domain/gps-settings';

export interface GpsEventNotificationRepository {
  telegramGroupBinding: {
    findUnique(args: unknown): Promise<{ telegramChatId: string } | null>;
  };
  telegramIdentity?: {
    findUnique(args: unknown): Promise<{ id: string; isActive: boolean } | null>;
  };
  botNotificationJob: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
}

export function buildGpsEventMapHref(input: {
  vehicleId: string;
  eventId: string;
  recordedAt: Date;
  kind?: 'SPEEDING' | 'HARSH_ACCELERATION' | 'HARSH_BRAKING';
}): string {
  const date = formatMoscowDate(input.recordedAt);
  return `/map?vehicleId=${encodeURIComponent(input.vehicleId)}&date=${date}&eventId=${encodeURIComponent(input.eventId)}`;
}

export async function queueGpsEventNotifications(input: {
  companyId: string;
  vehicleId: string;
  eventId: string;
  rentalId: string | null;
  clientId: string | null;
  recordedAt: Date;
  kind: 'SPEEDING' | 'HARSH_ACCELERATION' | 'HARSH_BRAKING';
  notificationMode: GpsNotificationMode;
  prisma: GpsEventNotificationRepository;
}): Promise<{ staffQueued: boolean; clientQueued: boolean }> {
  if (input.notificationMode === 'RECORD_ONLY') {
    return { staffQueued: false, clientQueued: false };
  }

  const mapHref = buildGpsEventMapHref(input);
  const binding = await input.prisma.telegramGroupBinding.findUnique({
    where: { companyId: input.companyId },
    select: { telegramChatId: true },
  });
  const staffResult = binding
    ? await input.prisma.botNotificationJob.createMany({
        data: [
          {
            companyId: input.companyId,
            chatId: binding.telegramChatId,
            eventKey: `gps-event:staff:${input.eventId}`,
            template: 'OPERATIONAL_ALERT',
            payload: {
              kind: input.kind,
              vehicleId: input.vehicleId,
              eventId: input.eventId,
              ...(input.rentalId ? { rentalId: input.rentalId } : {}),
              ...(input.clientId ? { clientId: input.clientId } : {}),
              recordedAt: input.recordedAt.toISOString(),
              mapHref,
            },
            availableAt: input.recordedAt,
          },
        ],
        skipDuplicates: true,
      })
    : { count: 0 };

  if (
    input.notificationMode !== 'STAFF_AND_CLIENT' ||
    !input.clientId ||
    !input.rentalId ||
    !input.prisma.telegramIdentity
  ) {
    return { staffQueued: staffResult.count > 0, clientQueued: false };
  }
  const identity = await input.prisma.telegramIdentity.findUnique({
    where: {
      companyId_clientId: { companyId: input.companyId, clientId: input.clientId },
    },
    select: { id: true, isActive: true },
  });
  if (!identity?.isActive) {
    return { staffQueued: staffResult.count > 0, clientQueued: false };
  }
  const clientResult = await input.prisma.botNotificationJob.createMany({
    data: [
      {
        companyId: input.companyId,
        identityId: identity.id,
        chatId: null,
        eventKey: `gps-event:client:${input.eventId}`,
        template: 'CLIENT_GPS_EVENT',
        payload: {
          kind: input.kind,
          vehicleId: input.vehicleId,
          eventId: input.eventId,
          rentalId: input.rentalId,
          clientId: input.clientId,
          recordedAt: input.recordedAt.toISOString(),
          mapHref,
        },
        availableAt: input.recordedAt,
      },
    ],
    skipDuplicates: true,
  });

  return { staffQueued: staffResult.count > 0, clientQueued: clientResult.count > 0 };
}

function formatMoscowDate(value: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
