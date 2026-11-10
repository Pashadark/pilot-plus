import { describe, expect, it, vi } from 'vitest';

import {
  formatClientRegionalGeofenceMessage,
  queueClientRegionalGeofenceNotifications,
} from './client-regional-geofence-notifications';

describe('client regional geofence notifications', () => {
  it('formats the immediate client warning with the blocking risk', () => {
    const message = formatClientRegionalGeofenceMessage({
      stage: 'IMMEDIATE',
      vehicle: 'Toyota Camry',
      registrationNumber: 'Р957АН997',
    });

    expect(message).toContain('🚨 <b>Выезд за разрешённую территорию</b>');
    expect(message).toContain('Toyota Camry · <code>Р957АН997</code>');
    expect(message).toContain('Автомобиль может быть дистанционно заблокирован');
    expect(message).toContain('Вернитесь в разрешённую территорию или свяжитесь с менеджером');
  });

  it('formats the one-hour reminder with the stronger action', () => {
    const message = formatClientRegionalGeofenceMessage({
      stage: 'ONE_HOUR',
      vehicle: 'Kia <Ceed>',
      registrationNumber: null,
    });

    expect(message).toContain('⛔ <b>Автомобиль всё ещё вне разрешённой территории</b>');
    expect(message).toContain('Kia &lt;Ceed&gt; · <code>без номера</code>');
    expect(message).toContain('⏱ <b>Прошёл 1 час</b>');
    expect(message).toContain('Срочно вернитесь в разрешённую территорию');
  });

  it('queues immediate and one-hour jobs for the active linked client', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      telegramIdentity: {
        findUnique: vi.fn().mockResolvedValue({ id: 'identity-1', isActive: true }),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      queueClientRegionalGeofenceNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        eventId: 'event-1',
        geofenceVersion: 3,
        recordedAt: new Date('2026-11-10T09:00:00.000Z'),
        prisma,
      }),
    ).resolves.toEqual({ immediateQueued: true, reminderQueued: true });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: 'company-1',
          identityId: 'identity-1',
          chatId: null,
          eventKey: 'regional-geofence:client:event-1:immediate',
          template: 'CLIENT_REGIONAL_GEOFENCE_ALERT',
          payload: expect.objectContaining({
            stage: 'IMMEDIATE',
            rentalId: 'rental-1',
            eventId: 'event-1',
            geofenceVersion: 3,
          }),
          availableAt: new Date('2026-11-10T09:00:00.000Z'),
        }),
        expect.objectContaining({
          eventKey: 'regional-geofence:client:event-1:one-hour',
          template: 'CLIENT_REGIONAL_GEOFENCE_ALERT',
          payload: expect.objectContaining({ stage: 'ONE_HOUR' }),
          availableAt: new Date('2026-11-10T10:00:00.000Z'),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not queue jobs without an active client identity', async () => {
    const createMany = vi.fn();
    const prisma = {
      telegramIdentity: {
        findUnique: vi.fn().mockResolvedValue({ id: 'identity-1', isActive: false }),
      },
      botNotificationJob: { createMany },
    };

    await expect(
      queueClientRegionalGeofenceNotifications({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        rentalId: 'rental-1',
        clientId: 'client-1',
        eventId: 'event-1',
        geofenceVersion: 3,
        recordedAt: new Date('2026-11-10T09:00:00.000Z'),
        prisma,
      }),
    ).resolves.toEqual({ immediateQueued: false, reminderQueued: false });
    expect(createMany).not.toHaveBeenCalled();
  });
});
