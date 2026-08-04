import 'server-only';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';

import type { WriteAuditLogInput } from './types';

const forbiddenKeys = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'secret',
  'content',
  'env',
]);
const maxChangesBytes = 16 * 1024;

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenKey);

  return Object.entries(value).some(
    ([key, nested]) =>
      forbiddenKeys.has(key.toLocaleLowerCase('en-US')) || containsForbiddenKey(nested),
  );
}

function prepareChanges(changes: Readonly<Record<string, unknown>> | undefined) {
  if (!changes) return undefined;
  if (containsForbiddenKey(changes)) {
    throw new Error('Журнал аудита содержит запрещённые поля.');
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(changes);
  } catch {
    throw new Error('Изменения для журнала аудита нельзя сериализовать.');
  }
  if (new TextEncoder().encode(serialized).byteLength > maxChangesBytes) {
    throw new Error('Изменения для журнала аудита превышают допустимый размер.');
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const changes = prepareChanges(input.changes);

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.id,
      actorEmailSnapshot: input.actor.email,
      action: input.action,
      entityType: input.entityType,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.entityLabel ? { entityLabel: input.entityLabel } : {}),
      ...(changes === undefined ? {} : { changes }),
    },
  });
}
