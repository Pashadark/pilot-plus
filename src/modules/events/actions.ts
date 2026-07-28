'use server';

import { revalidatePath } from 'next/cache';

import type { Prisma } from '@/database/generated/prisma';
import { prisma } from '@/database/prisma/client';
import { getAuthenticatedSession } from '@/services/auth/session';

import { parseEventKey } from './event-key';
import { getEventTimeline, type TimelineFilters } from './server/queries';
import { createManualEventSchema, eventReadKeySchema, eventReadKeysSchema } from './validation';

export type EventActionState = { status: 'idle' | 'success' | 'error'; message: string };

type AuthorizedEventContext = {
  companyId: string;
  userId: string;
};

type EventSource =
  | 'vehicle-position'
  | 'trip'
  | 'vehicle-event'
  | 'fuel-record'
  | 'maintenance-record'
  | 'wash-record'
  | 'device-command'
  | 'manual-vehicle-event';

const SESSION_ERROR: EventActionState = {
  status: 'error',
  message: 'Сессия истекла. Войдите снова.',
};
const VEHICLE_UNAVAILABLE_ERROR: EventActionState = {
  status: 'error',
  message: 'Автомобиль недоступен.',
};
const EVENT_UNAVAILABLE_ERROR: EventActionState = {
  status: 'error',
  message: 'Событие недоступно.',
};
const EVENT_KEYS_ERROR: EventActionState = {
  status: 'error',
  message: 'Проверьте ключи событий.',
};

function formValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

function optionalFormValue(formData: FormData, field: string): string | undefined {
  const value = formValue(formData, field).trim();
  return value || undefined;
}

async function getAuthorizedEventContext(): Promise<AuthorizedEventContext | null> {
  const session = await getAuthenticatedSession();
  if (!session) return null;

  const membership = await prisma.companyMember.findFirst({
    where: { userId: session.user.id, role: 'ADMIN' },
    select: { companyId: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) return null;

  return { companyId: membership.companyId, userId: session.user.id };
}

function asEventSource(source: string): EventSource | null {
  return source === 'vehicle-position' ||
    source === 'trip' ||
    source === 'vehicle-event' ||
    source === 'fuel-record' ||
    source === 'maintenance-record' ||
    source === 'wash-record' ||
    source === 'device-command' ||
    source === 'manual-vehicle-event'
    ? source
    : null;
}

type EventReader = Pick<
  Prisma.TransactionClient,
  | 'vehiclePosition'
  | 'trip'
  | 'vehicleEvent'
  | 'fuelRecord'
  | 'maintenanceRecord'
  | 'washRecord'
  | 'deviceCommand'
  | 'manualVehicleEvent'
>;

async function findAccessibleSourceIds(
  transaction: EventReader,
  context: AuthorizedEventContext,
  source: EventSource,
  ids: string[],
): Promise<string[]> {
  const whereWithVehicle = { id: { in: ids }, vehicle: { companyId: context.companyId } };
  const options = { select: { id: true }, take: ids.length };

  switch (source) {
    case 'vehicle-position':
      return (
        await transaction.vehiclePosition.findMany({ where: whereWithVehicle, ...options })
      ).map((record) => record.id);
    case 'trip':
      return (await transaction.trip.findMany({ where: whereWithVehicle, ...options })).map(
        (record) => record.id,
      );
    case 'vehicle-event':
      return (await transaction.vehicleEvent.findMany({ where: whereWithVehicle, ...options })).map(
        (record) => record.id,
      );
    case 'fuel-record':
      return (await transaction.fuelRecord.findMany({ where: whereWithVehicle, ...options })).map(
        (record) => record.id,
      );
    case 'maintenance-record':
      return (
        await transaction.maintenanceRecord.findMany({ where: whereWithVehicle, ...options })
      ).map((record) => record.id);
    case 'wash-record':
      return (await transaction.washRecord.findMany({ where: whereWithVehicle, ...options })).map(
        (record) => record.id,
      );
    case 'device-command':
      return (
        await transaction.deviceCommand.findMany({
          where: {
            id: { in: ids },
            companyId: context.companyId,
            device: { companyId: context.companyId, vehicleId: { not: null } },
          },
          ...options,
        })
      ).map((record) => record.id);
    case 'manual-vehicle-event':
      return (
        await transaction.manualVehicleEvent.findMany({
          where: { id: { in: ids }, companyId: context.companyId },
          ...options,
        })
      ).map((record) => record.id);
  }
}

async function verifyAccessibleEventKeys(
  transaction: EventReader,
  context: AuthorizedEventContext,
  eventKeys: string[],
): Promise<Set<string> | null> {
  const keysBySource = new Map<EventSource, Map<string, string>>();

  for (const key of eventKeys) {
    const parsed = parseEventKey(key);
    const source = parsed && asEventSource(parsed.source);
    if (!parsed || !source) return null;

    const sourceKeys = keysBySource.get(source) ?? new Map<string, string>();
    sourceKeys.set(parsed.id, key);
    keysBySource.set(source, sourceKeys);
  }

  const verified = new Set<string>();
  for (const [source, sourceKeys] of keysBySource) {
    const ids = [...sourceKeys.keys()];
    const accessibleIds = await findAccessibleSourceIds(transaction, context, source, ids);
    if (accessibleIds.length !== ids.length) return null;

    for (const id of accessibleIds) {
      const key = sourceKeys.get(id);
      if (!key) return null;
      verified.add(key);
    }
  }

  return verified.size === eventKeys.length ? verified : null;
}

function revalidateEvents(vehicleId?: string): void {
  revalidatePath('/events');
  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`);
  else revalidatePath('/vehicles/[id]', 'page');
}

export async function createManualEventAction(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const parsed = createManualEventSchema.safeParse({
    vehicleId: formValue(formData, 'vehicleId'),
    kind: formValue(formData, 'kind'),
    severity: formValue(formData, 'severity'),
    title: formValue(formData, 'title'),
    description: optionalFormValue(formData, 'description'),
    location: optionalFormValue(formData, 'location'),
    latitude: optionalFormValue(formData, 'latitude'),
    longitude: optionalFormValue(formData, 'longitude'),
    recordedAt: formValue(formData, 'recordedAt'),
  });
  if (!parsed.success) return { status: 'error', message: 'Проверьте заполнение полей.' };

  const context = await getAuthorizedEventContext();
  if (!context) return SESSION_ERROR;

  try {
    const event = await prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findFirst({
        where: { id: parsed.data.vehicleId, companyId: context.companyId },
        select: { id: true },
      });
      if (!vehicle) return null;

      return transaction.manualVehicleEvent.create({
        data: {
          companyId: context.companyId,
          vehicleId: vehicle.id,
          authorId: context.userId,
          kind: parsed.data.kind,
          severity: parsed.data.severity,
          title: parsed.data.title,
          description: parsed.data.description,
          location: parsed.data.location,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          recordedAt: new Date(parsed.data.recordedAt),
        },
        select: { vehicleId: true },
      });
    });
    if (!event) return VEHICLE_UNAVAILABLE_ERROR;

    revalidateEvents(event.vehicleId);
    return { status: 'success', message: 'Запись добавлена в историю.' };
  } catch {
    return { status: 'error', message: 'Не удалось добавить запись. Попробуйте позже.' };
  }
}

async function markAccessibleEventsRead(
  context: AuthorizedEventContext,
  eventKeys: string[],
): Promise<EventActionState> {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const verifiedKeys = await verifyAccessibleEventKeys(transaction, context, eventKeys);
      if (!verifiedKeys) return false;

      for (const eventKey of verifiedKeys) {
        await transaction.eventReadReceipt.upsert({
          where: { userId_eventKey: { userId: context.userId, eventKey } },
          create: { companyId: context.companyId, userId: context.userId, eventKey },
          update: { readAt: new Date() },
        });
      }
      return true;
    });
    if (!result) return EVENT_UNAVAILABLE_ERROR;

    revalidateEvents();
    return { status: 'success', message: 'События отмечены прочитанными.' };
  } catch {
    return {
      status: 'error',
      message: 'Не удалось отметить события прочитанными. Попробуйте позже.',
    };
  }
}

export async function markEventReadAction(eventKey: string): Promise<EventActionState> {
  const parsed = eventReadKeySchema.safeParse(eventKey);
  if (!parsed.success) return EVENT_KEYS_ERROR;

  const context = await getAuthorizedEventContext();
  if (!context) return SESSION_ERROR;

  const result = await markAccessibleEventsRead(context, [parsed.data]);
  return result.status === 'success'
    ? { status: 'success', message: 'Событие отмечено прочитанным.' }
    : result;
}

export async function markEventsReadAction(eventKeys: string[]): Promise<EventActionState> {
  const parsed = eventReadKeysSchema.safeParse(eventKeys);
  if (!parsed.success) return EVENT_KEYS_ERROR;

  const context = await getAuthorizedEventContext();
  if (!context) return SESSION_ERROR;

  return markAccessibleEventsRead(context, [...new Set(parsed.data)]);
}

export async function markAllEventsReadAction(filters: TimelineFilters): Promise<EventActionState> {
  const context = await getAuthorizedEventContext();
  if (!context) return SESSION_ERROR;

  try {
    const timeline = await getEventTimeline(filters);
    const eventKeys = [...new Set(timeline.events.map((event) => event.key))];
    if (eventKeys.length === 0) {
      return { status: 'success', message: 'Нет доступных событий для отметки.' };
    }

    const parsed = eventReadKeysSchema.safeParse(eventKeys);
    if (!parsed.success) return EVENT_KEYS_ERROR;

    return markAccessibleEventsRead(context, parsed.data);
  } catch {
    return {
      status: 'error',
      message: 'Не удалось отметить события прочитанными. Попробуйте позже.',
    };
  }
}
