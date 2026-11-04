import { describe, expect, it, vi } from 'vitest';

import { buildGpsEventMapHref, queueGpsEventNotifications } from './gps-event-notifications';

describe('GPS event notification queue', () => {
  it('builds a deterministic Supa Pro deep link to the selected event', () => {
    expect(
      buildGpsEventMapHref({
        vehicleId: 'vehicle 1',
        eventId: 'event/1',
        recordedAt: new Date('2026-10-25T12:00:00.000Z'),
      }),
    ).toBe('/map?vehicleId=vehicle%201&date=2026-10-25&eventId=event%2F1');
  });

  it('does not create a sendable job in RECORD_ONLY mode', async () => {
    const prisma = {
      telegramGroupBinding: { findUnique: vi.fn() },
      telegramIdentity: { findUnique: vi.fn() },
      botNotificationJob: { createMany: vi.fn() },
    };

    await expect(
      queueGpsEventNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        eventId: 'event-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        recordedAt: new Date('2026-10-25T12:00:00.000Z'),
        kind: 'HARSH_ACCELERATION',
        notificationMode: 'RECORD_ONLY',
        prisma,
      }),
    ).resolves.toEqual({ staffQueued: false, clientQueued: false });
    expect(prisma.telegramGroupBinding.findUnique).not.toHaveBeenCalled();
    expect(prisma.botNotificationJob.createMany).not.toHaveBeenCalled();
  });

  it('queues one idempotent staff alert with the map and rental context', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100123' }),
      },
      telegramIdentity: { findUnique: vi.fn() },
      botNotificationJob: { createMany },
    };

    await expect(
      queueGpsEventNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        eventId: 'event-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        recordedAt: new Date('2026-10-25T12:00:00.000Z'),
        kind: 'HARSH_ACCELERATION',
        notificationMode: 'STAFF_ONLY',
        prisma,
      }),
    ).resolves.toEqual({ staffQueued: true, clientQueued: false });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: 'company-1',
          chatId: '-100123',
          eventKey: 'gps-event:staff:event-1',
          template: 'OPERATIONAL_ALERT',
          payload: {
            kind: 'HARSH_ACCELERATION',
            vehicleId: 'vehicle-1',
            eventId: 'event-1',
            rentalId: 'rental-1',
            clientId: 'client-1',
            recordedAt: '2026-10-25T12:00:00.000Z',
            mapHref: '/map?vehicleId=vehicle-1&date=2026-10-25&eventId=event-1',
          },
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('queues an idempotent speeding alert for the linked client and staff', async () => {
    const createMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = {
      telegramGroupBinding: {
        findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100123' }),
      },
      telegramIdentity: {
        findUnique: vi.fn().mockResolvedValue({ id: 'identity-1', isActive: true }),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      queueGpsEventNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        eventId: 'event-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        recordedAt: new Date('2026-10-25T12:00:00.000Z'),
        kind: 'SPEEDING',
        notificationMode: 'STAFF_AND_CLIENT',
        prisma,
      }),
    ).resolves.toEqual({ staffQueued: true, clientQueued: true });

    expect(createMany).toHaveBeenNthCalledWith(2, {
      data: [
        expect.objectContaining({
          companyId: 'company-1',
          identityId: 'identity-1',
          chatId: null,
          eventKey: 'gps-event:client:event-1',
          template: 'CLIENT_GPS_EVENT',
          payload: expect.objectContaining({
            kind: 'SPEEDING',
            vehicleId: 'vehicle-1',
            eventId: 'event-1',
            rentalId: 'rental-1',
            clientId: 'client-1',
          }),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('queues the client alert even when no staff group is bound', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue(null) },
      telegramIdentity: {
        findUnique: vi.fn().mockResolvedValue({ id: 'identity-1', isActive: true }),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      queueGpsEventNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        eventId: 'event-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        recordedAt: new Date('2026-10-25T12:00:00.000Z'),
        kind: 'HARSH_ACCELERATION',
        notificationMode: 'STAFF_AND_CLIENT',
        prisma,
      }),
    ).resolves.toEqual({ staffQueued: false, clientQueued: true });
    expect(createMany).toHaveBeenCalledTimes(1);
  });
});
