import { describe, it, expect, vi } from 'vitest';
import { parseWebsiteLead, receiveWebsiteLead } from './website-intake';
const now = new Date('2026-09-20T09:00:00Z');
const input = {
  requestId: '123e4567-e89b-42d3-a456-426614174000',
  name: 'Тестовый клиент',
  phone: '+7 (999) 123-45-67',
  vehicleId: 'vehicle-1',
  start: '2026-10-03',
  end: '2026-10-05',
  startTime: '10:00',
  endTime: '10:00',
  comment: 'Тест',
  consent: true,
};
const config = {
  companyId: 'company-1',
  userId: 'manager-1',
  encryptionKey: Buffer.alloc(32, 1).toString('base64'),
  searchKey: 'test-search',
};
function setup() {
  const tx = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'manager-1', email: 'test@example.test' }) },
    vehicle: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'vehicle-1', model: 'Camry', dailyPriceMinor: 450000 }),
    },
    lead: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'new' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    telegramGroupBinding: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ telegramChatId: '-100123', boundByUserId: 'manager-1' }),
    },
    telegramIdentity: { findFirst: vi.fn().mockResolvedValue({ id: 'staff-1' }) },
    botNotificationJob: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return { tx, db: { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
}
describe('website lead intake', () => {
  it('normalizes phone and validates consent/date limits', () => {
    expect(parseWebsiteLead(input, now).phone).toBe('79991234567');
    expect(() => parseWebsiteLead({ ...input, consent: false }, now)).toThrow();
    expect(() => parseWebsiteLead({ ...input, end: '2026-10-02' }, now)).toThrow();
    expect(() => parseWebsiteLead({ ...input, start: '2026-02-30' }, now)).toThrow();
  });
  it('creates tenant-scoped lead and audit, not a booking', async () => {
    const { tx, db } = setup();
    const result = await receiveWebsiteLead(input, config, db as never, now);
    expect(result.id).toMatch(/^tgcar_/);
    expect(tx.lead.create.mock.calls[0][0].data).toMatchObject({
      companyId: 'company-1',
      source: 'TG CAR',
      status: 'NEW',
      createdByUserId: 'manager-1',
    });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(tx.botNotificationJob.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ template: 'LEAD_CREATED', chatId: '-100123' }),
      ]),
      skipDuplicates: true,
    });
    expect(tx.vehicle.findFirst.mock.calls[0][0].where.companyId).toBe('company-1');
  });
  it('same request is idempotent and altered payload conflicts', async () => {
    const { tx, db } = setup();
    await receiveWebsiteLead(input, config, db as never, now);
    const row = tx.lead.create.mock.calls[0][0].data;
    tx.lead.findUnique.mockResolvedValue(row);
    tx.lead.create.mockClear();
    tx.botNotificationJob.createMany.mockClear();
    await receiveWebsiteLead(input, config, db as never, now);
    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.botNotificationJob.createMany).not.toHaveBeenCalled();
    await expect(
      receiveWebsiteLead({ ...input, name: 'Другое имя' }, config, db as never, now),
    ).rejects.toThrow('CONFLICT');
  });
  it('rejects missing operator, foreign vehicle, and rate exhaustion', async () => {
    const { tx, db } = setup();
    tx.user.findFirst.mockResolvedValue(null);
    await expect(receiveWebsiteLead(input, config, db as never, now)).rejects.toThrow();
    tx.user.findFirst.mockResolvedValue({ id: 'manager-1', email: 'test@example.test' });
    tx.vehicle.findFirst.mockResolvedValue(null);
    await expect(receiveWebsiteLead(input, config, db as never, now)).rejects.toThrow('VEHICLE');
    tx.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      model: 'Camry',
      dailyPriceMinor: 450000,
    });
    tx.lead.count.mockResolvedValue(100);
    await expect(receiveWebsiteLead(input, config, db as never, now)).rejects.toThrow('RATE');
  });
});
