import { createHash } from 'node:crypto';
import type { PrismaClient } from '@/database/generated/prisma';
import { blindIndex, decryptField, encryptField } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';
import { enqueueWebsiteNotifications } from './enqueue-website-notifications';

type Configuration = {
  companyId: string;
  userId: string;
  encryptionKey: string;
  searchKey: string;
};
export function parseWebsiteLead(value: unknown, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID');
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number) => {
    if (typeof v[key] !== 'string' || (v[key] as string).length > max) throw new Error('INVALID');
    return (v[key] as string).trim();
  };
  const requestId = text('requestId', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
    throw new Error('INVALID');
  const name = text('name', 150),
    phone = normalizeRussianPhone(text('phone', 30)),
    vehicleId = text('vehicleId', 80),
    comment = text('comment', 1000);
  if (name.length < 2 || !/^7\d{10}$/.test(phone) || !vehicleId || v.consent !== true)
    throw new Error('INVALID');
  const start = text('start', 10),
    end = text('end', 10),
    startTime = text('startTime', 5),
    endTime = text('endTime', 5);
  function date(day: string, time: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error('INVALID');
    const utc = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== day)
      throw new Error('INVALID');
    return Date.parse(day + 'T' + time + ':00+03:00');
  }
  const from = date(start, startTime),
    to = date(end, endTime);
  if (from < now.getTime() - 60000 || to <= from || to - from > 366 * 86400000)
    throw new Error('INVALID');
  return {
    requestId: requestId.toLowerCase(),
    name,
    phone,
    vehicleId,
    comment,
    start,
    end,
    startTime,
    endTime,
    days: Math.ceil((to - from) / 86400000),
    consentVersion: 'tgcar-lead-v1',
  };
}
export async function receiveWebsiteLead(
  value: unknown,
  config: Configuration,
  db: Pick<PrismaClient, '$transaction'>,
  now = new Date(),
) {
  const input = parseWebsiteLead(value, now);
  if (!config.companyId || !config.userId || !config.encryptionKey || !config.searchKey)
    throw new Error('CONFIGURATION');
  const digest = (s: string) => createHash('sha256').update(s).digest('hex');
  const id = 'tgcar_' + digest(config.companyId + ':' + input.requestId).slice(0, 40);
  const fingerprint = digest(JSON.stringify(input));
  return db.$transaction(
    async (tx) => {
      const operator = await tx.user.findFirst({
        where: {
          id: config.userId,
          isActive: true,
          memberships: {
            some: { companyId: config.companyId, role: { in: ['COMPANY_ADMIN', 'DISPATCHER'] } },
          },
        },
        select: { id: true, email: true },
      });
      if (!operator) throw new Error('CONFIGURATION');
      const existing = await tx.lead.findUnique({
        where: { id },
        select: { id: true, companyId: true, commentEncrypted: true },
      });
      if (existing) {
        if (
          existing.companyId !== config.companyId ||
          !existing.commentEncrypted ||
          !decryptField(existing.commentEncrypted, config.encryptionKey).endsWith(
            'Код проверки: ' + fingerprint,
          )
        )
          throw new Error('CONFLICT');
        return { id, duplicate: true };
      }
      const vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, companyId: config.companyId, archivedAt: null },
        select: { id: true, model: true, dailyPriceMinor: true },
      });
      if (!vehicle) throw new Error('VEHICLE');
      const phoneIndex = blindIndex(input.phone, config.searchKey, normalizeRussianPhone);
      const count = await tx.lead.count({
        where: {
          companyId: config.companyId,
          source: 'TG CAR',
          createdAt: { gte: new Date(now.getTime() - 60000) },
        },
      });
      const phoneCount = await tx.lead.count({
        where: {
          companyId: config.companyId,
          source: 'TG CAR',
          phoneIndex,
          createdAt: { gte: new Date(now.getTime() - 3600000) },
        },
      });
      if (count >= 20 || phoneCount >= 3) throw new Error('RATE');
      const price =
        vehicle.dailyPriceMinor && vehicle.dailyPriceMinor > 0
          ? `${((vehicle.dailyPriceMinor * input.days) / 100).toLocaleString('ru-RU')} ₽ за ${input.days} сут.`
          : 'Тариф требует уточнения';
      const comment = [
        `Автомобиль: ${vehicle.model} (${vehicle.id})`,
        `Период: ${input.start} ${input.startTime} — ${input.end} ${input.endTime} (Москва)`,
        `Предварительный расчёт: ${price}`,
        'Телефон не подтверждён. Это обращение, не бронь и не договор.',
        `Комментарий: ${input.comment || '—'}`,
        `Согласие: ${input.consentVersion}, получено ${now.toISOString()}`,
        `Код проверки: ${fingerprint}`,
      ].join('\n');
      await tx.lead.create({
        data: {
          id,
          companyId: config.companyId,
          name: input.name,
          phoneEncrypted: encryptField(input.phone, config.encryptionKey),
          phoneIndex,
          source: 'TG CAR',
          commentEncrypted: encryptField(comment, config.encryptionKey),
          status: 'NEW',
          createdByUserId: operator.id,
          assignedToUserId: operator.id,
        },
      });
      const audit = await tx.auditLog.create({
        data: {
          companyId: config.companyId,
          actorUserId: operator.id,
          actorEmailSnapshot: operator.email,
          action: 'CREATE',
          entityType: 'SYSTEM',
          entityId: id,
          entityLabel: 'LEAD',
          changes: {
            source: 'TG CAR',
            status: 'NEW',
            phoneVerified: false,
            consentVersion: input.consentVersion,
            receivedAt: now.toISOString(),
            vehicleId: vehicle.id,
          },
        },
      });
      await enqueueWebsiteNotifications(
        tx,
        { companyId: config.companyId, leadId: id, auditId: audit.id, template: 'LEAD_CREATED' },
        now,
      );
      return { id, duplicate: false };
    },
    { isolationLevel: 'Serializable' },
  );
}
