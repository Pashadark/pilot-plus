import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn() }));
const timelineMocks = vi.hoisted(() => ({ getEventTimeline: vi.fn() }));
const transaction = vi.hoisted(() => ({
  vehicle: { findFirst: vi.fn() },
  manualVehicleEvent: { create: vi.fn() },
  vehicleEvent: { findMany: vi.fn() },
  trip: { findMany: vi.fn() },
  vehiclePosition: { findMany: vi.fn() },
  fuelRecord: { findMany: vi.fn() },
  maintenanceRecord: { findMany: vi.fn() },
  washRecord: { findMany: vi.fn() },
  deviceCommand: { findMany: vi.fn() },
  manualVehicleEventReceipt: { findMany: vi.fn() },
  eventReadReceipt: { upsert: vi.fn() },
}));
const repository = vi.hoisted(() => ({
  companyMember: { findFirst: vi.fn() },
  vehicleEvent: transaction.vehicleEvent,
  trip: transaction.trip,
  vehiclePosition: transaction.vehiclePosition,
  fuelRecord: transaction.fuelRecord,
  maintenanceRecord: transaction.maintenanceRecord,
  washRecord: transaction.washRecord,
  deviceCommand: transaction.deviceCommand,
  manualVehicleEvent: {
    create: transaction.manualVehicleEvent.create,
    findMany: transaction.manualVehicleEventReceipt.findMany,
  },
  eventReadReceipt: transaction.eventReadReceipt,
  $transaction: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
}));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));
vi.mock('./server/queries', () => ({ getEventTimeline: timelineMocks.getEventTimeline }));

import {
  createManualEventAction,
  markAllEventsReadAction,
  markEventReadAction,
  markEventsReadAction,
  type EventActionState,
} from './actions';

const initialState: EventActionState = { status: 'idle', message: '' };
const session = {
  user: { id: 'user-1', email: 'admin@example.com', name: 'Администратор', role: 'ADMIN' as const },
  currentSessionId: 'session-1',
  currentSessionTokenHash: 'token-hash',
  currentSessionExpiresAt: new Date('2026-08-05T00:00:00.000Z'),
};

function manualEventForm(vehicleId = 'vehicle-1') {
  const formData = new FormData();
  formData.set('vehicleId', vehicleId);
  formData.set('kind', 'INCIDENT');
  formData.set('severity', 'DANGER');
  formData.set('title', '  ДТП на парковке  ');
  formData.set('description', '  Нужна оценка повреждений  ');
  formData.set('location', '  Москва  ');
  formData.set('latitude', '55.7558');
  formData.set('longitude', '37.6173');
  formData.set('recordedAt', '2026-07-27T12:00:00.000+03:00');
  formData.set('companyId', 'foreign-company');
  formData.set('authorId', 'foreign-user');
  return formData;
}

function timeline(keys: string[]) {
  return {
    events: keys.map((key) => ({ key })),
    nextCursor: null,
    stats: { total: keys.length, danger: 0, unread: keys.length, vehicles: 1 },
    vehicles: [],
  };
}

describe('действия истории событий', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedSession.mockResolvedValue(session);
    repository.companyMember.findFirst.mockResolvedValue({ companyId: 'company-1' });
    repository.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
    transaction.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1' });
    transaction.manualVehicleEvent.create.mockResolvedValue({
      id: 'manual-1',
      vehicleId: 'vehicle-1',
    });
    transaction.vehicleEvent.findMany.mockResolvedValue([
      { id: 'event-1', vehicleId: 'vehicle-1' },
    ]);
    transaction.trip.findMany.mockResolvedValue([]);
    transaction.vehiclePosition.findMany.mockResolvedValue([]);
    transaction.fuelRecord.findMany.mockResolvedValue([]);
    transaction.maintenanceRecord.findMany.mockResolvedValue([]);
    transaction.washRecord.findMany.mockResolvedValue([]);
    transaction.deviceCommand.findMany.mockResolvedValue([]);
    transaction.manualVehicleEventReceipt.findMany.mockResolvedValue([]);
    transaction.eventReadReceipt.upsert.mockResolvedValue({ id: 'receipt-1' });
    timelineMocks.getEventTimeline.mockResolvedValue(timeline(['vehicle-event:event-1']));
  });

  it('отклоняет действия без сессии до обращения к данным', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(createManualEventAction(initialState, manualEventForm())).resolves.toEqual({
      status: 'error',
      message: 'Сессия истекла. Войдите снова.',
    });
    expect(repository.companyMember.findFirst).not.toHaveBeenCalled();
    expect(repository.$transaction).not.toHaveBeenCalled();
  });

  it('не создаёт запись для автомобиля другой компании', async () => {
    transaction.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      createManualEventAction(initialState, manualEventForm('foreign-vehicle')),
    ).resolves.toEqual({
      status: 'error',
      message: 'Автомобиль недоступен.',
    });
    expect(transaction.manualVehicleEvent.create).not.toHaveBeenCalled();
  });

  it('сохраняет ручную запись только с авторизованными компанией и автором', async () => {
    await expect(createManualEventAction(initialState, manualEventForm())).resolves.toEqual({
      status: 'success',
      message: 'Запись добавлена в историю.',
    });
    expect(transaction.manualVehicleEvent.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        vehicleId: 'vehicle-1',
        authorId: 'user-1',
        kind: 'INCIDENT',
        severity: 'DANGER',
        title: 'ДТП на парковке',
        description: 'Нужна оценка повреждений',
        location: 'Москва',
        latitude: 55.7558,
        longitude: 37.6173,
        recordedAt: new Date('2026-07-27T09:00:00.000Z'),
      },
      select: { vehicleId: true },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/events');
    expect(revalidatePathMock).toHaveBeenCalledWith('/vehicles/vehicle-1');
  });

  it('не создаёт receipt для события, недоступного компании', async () => {
    transaction.vehicleEvent.findMany.mockResolvedValue([]);

    await expect(markEventReadAction('vehicle-event:foreign-event')).resolves.toEqual({
      status: 'error',
      message: 'Событие недоступно.',
    });
    expect(transaction.eventReadReceipt.upsert).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('отклоняет больше ста ключей до запросов к источникам', async () => {
    const keys = Array.from({ length: 101 }, (_, index) => `vehicle-event:event-${index}`);

    await expect(markEventsReadAction(keys)).resolves.toEqual({
      status: 'error',
      message: 'Проверьте ключи событий.',
    });
    expect(transaction.vehicleEvent.findMany).not.toHaveBeenCalled();
    expect(repository.$transaction).not.toHaveBeenCalled();
  });

  it('идемпотентно обновляет receipt при повторной отметке', async () => {
    await expect(markEventReadAction('vehicle-event:event-1')).resolves.toEqual({
      status: 'success',
      message: 'Событие отмечено прочитанным.',
    });
    await expect(markEventReadAction('vehicle-event:event-1')).resolves.toEqual({
      status: 'success',
      message: 'Событие отмечено прочитанным.',
    });

    expect(transaction.eventReadReceipt.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.eventReadReceipt.upsert).toHaveBeenLastCalledWith({
      where: { userId_eventKey: { userId: 'user-1', eventKey: 'vehicle-event:event-1' } },
      create: { companyId: 'company-1', userId: 'user-1', eventKey: 'vehicle-event:event-1' },
      update: { readAt: expect.any(Date) },
    });
  });

  it('массово отмечает только ключи tenant-safe результата ленты', async () => {
    timelineMocks.getEventTimeline.mockResolvedValue(timeline(['vehicle-event:event-1']));

    await expect(
      markAllEventsReadAction({ vehicleId: 'vehicle-1', limit: 100, read: 'unread' }),
    ).resolves.toEqual({
      status: 'success',
      message: 'События отмечены прочитанными.',
    });

    expect(timelineMocks.getEventTimeline).toHaveBeenCalledWith({
      vehicleId: 'vehicle-1',
      limit: 100,
      read: 'unread',
    });
    expect(transaction.eventReadReceipt.upsert).toHaveBeenCalledTimes(1);
    expect(transaction.eventReadReceipt.upsert).toHaveBeenCalledWith({
      where: { userId_eventKey: { userId: 'user-1', eventKey: 'vehicle-event:event-1' } },
      create: { companyId: 'company-1', userId: 'user-1', eventKey: 'vehicle-event:event-1' },
      update: { readAt: expect.any(Date) },
    });
  });
});
