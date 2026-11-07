import { describe, expect, it, vi } from 'vitest';

import { SERVICE_ZONE } from '../service-zone';
import { processVehicleServicePosition } from './service-visit-service';

function database(active: Record<string, unknown> | null = null) {
  return {
    vehicleServiceVisit: {
      findFirst: vi.fn().mockResolvedValue(active),
      create: vi.fn().mockResolvedValue({ id: 'visit-new' }),
      update: vi.fn().mockResolvedValue({ id: active?.id ?? 'visit-new' }),
    },
    telegramGroupBinding: {
      findUnique: vi.fn().mockResolvedValue({ telegramChatId: '-100123' }),
    },
    botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
}

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 7, 9, minutes));

describe('processVehicleServicePosition', () => {
  it('opens a visit on the first fresh point inside the service zone', async () => {
    const db = database();

    const result = await processVehicleServicePosition(db, {
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latitude: SERVICE_ZONE.latitude,
      longitude: SERVICE_ZONE.longitude,
      recordedAt: at(0),
      receivedAt: at(0),
    });

    expect(result.type).toBe('ENTER');
    expect(db.vehicleServiceVisit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        enteredAt: at(0),
        lastInsideAt: at(0),
      }),
      select: { id: true },
    });
    expect(db.botNotificationJob.createMany).not.toHaveBeenCalled();
  });

  it('confirms after 40 minutes and queues one staff-only notification', async () => {
    const db = database({
      id: 'visit-1',
      enteredAt: at(0),
      lastInsideAt: at(39),
      confirmedAt: null,
      exitedAt: null,
    });

    const result = await processVehicleServicePosition(db, {
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latitude: SERVICE_ZONE.latitude,
      longitude: SERVICE_ZONE.longitude,
      recordedAt: at(40),
      receivedAt: at(40),
    });

    expect(result.type).toBe('CONFIRM');
    expect(db.vehicleServiceVisit.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: { confirmedAt: at(40), lastInsideAt: at(40), notificationQueuedAt: at(40) },
    });
    expect(db.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: 'company-1',
          chatId: '-100123',
          template: 'OPERATIONAL_ALERT',
          eventKey: 'service-arrival:visit-1',
          payload: expect.objectContaining({
            kind: 'SERVICE_CENTER_ARRIVAL',
            vehicleId: 'vehicle-1',
          }),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not notify again for an already confirmed active visit', async () => {
    const db = database({
      id: 'visit-1',
      enteredAt: at(0),
      lastInsideAt: at(40),
      confirmedAt: at(40),
      exitedAt: null,
      notificationQueuedAt: at(40),
    });

    await processVehicleServicePosition(db, {
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latitude: SERVICE_ZONE.latitude,
      longitude: SERVICE_ZONE.longitude,
      recordedAt: at(45),
      receivedAt: at(45),
    });

    expect(db.botNotificationJob.createMany).not.toHaveBeenCalled();
    expect(db.vehicleServiceVisit.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: { lastInsideAt: at(45) },
    });
  });

  it('closes the active visit after a fresh point outside the zone', async () => {
    const db = database({
      id: 'visit-1',
      enteredAt: at(0),
      lastInsideAt: at(40),
      confirmedAt: at(40),
      exitedAt: null,
    });

    const result = await processVehicleServicePosition(db, {
      companyId: 'company-1',
      vehicleId: 'vehicle-1',
      latitude: SERVICE_ZONE.latitude + 0.01,
      longitude: SERVICE_ZONE.longitude,
      recordedAt: at(50),
      receivedAt: at(50),
    });

    expect(result.type).toBe('EXIT');
    expect(db.vehicleServiceVisit.update).toHaveBeenCalledWith({
      where: { id: 'visit-1' },
      data: { exitedAt: at(50) },
    });
  });
});
