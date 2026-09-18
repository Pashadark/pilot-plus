import { describe, expect, it, vi } from 'vitest';

import { processFuelStationPosition } from './visit-service';

describe('processFuelStationPosition', () => {
  it('creates one notification after continuous seven-minute dwell', async () => {
    const enteredAt = new Date('2026-09-18T08:00:00Z');
    const active = { id: 'visit-1', stationId: 'station-1', enteredAt, lastSeenAt: enteredAt, notifiedAt: null };
    const database = {
      fuelStation: { findMany: vi.fn().mockResolvedValue([{ id: 'station-1', name: 'АЗС Тест', address: 'Москва', latitude: 55.75, longitude: 37.61 }]) },
      fuelStationVisit: { findFirst: vi.fn().mockResolvedValue(active), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
      telegramGroupBinding: { findUnique: vi.fn().mockResolvedValue({ telegramChatId: 'chat-1' }) },
      botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const result = await processFuelStationPosition(database, { companyId: 'company-1', vehicleId: 'vehicle-1', latitude: 55.75, longitude: 37.61, recordedAt: new Date('2026-09-18T08:07:00Z') });
    expect(result.kind).toBe('possibleRefuelling');
    expect(database.fuelStationVisit.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'visit-1' }, data: expect.objectContaining({ notifiedAt: new Date('2026-09-18T08:07:00Z') }) }));
    expect(database.botNotificationJob.createMany).toHaveBeenCalledTimes(1);
  });
});
