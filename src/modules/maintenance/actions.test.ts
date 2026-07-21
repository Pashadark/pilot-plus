import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn() }));
const repository = vi.hoisted(() => ({
  vehicle: { findFirst: vi.fn() },
  maintenanceRecord: { create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
}));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));

import { createMaintenanceAction, transitionMaintenanceAction } from './actions';

const initialState = { status: 'idle' as const };
const session = {
  user: { id: 'user-1', email: 'admin@example.com', name: 'Администратор', role: 'ADMIN' as const },
  currentSessionId: 'session-1',
  currentSessionTokenHash: 'token-hash',
  currentSessionExpiresAt: new Date('2026-07-28T00:00:00.000Z'),
};

function validFormData() {
  const formData = new FormData();
  formData.set('vehicleId', 'vehicle-1');
  formData.set('title', 'Замена масла');
  formData.set('kind', 'OIL');
  formData.set('scheduledAt', '2026-07-23T10:00');
  formData.set('targetOdometerKm', '15000');
  formData.set('provider', 'Сервис Pilot');
  formData.set('costRubles', '4200');
  formData.set('notes', 'Плановая замена');
  return formData;
}

function transitionFormData(fromStatus: string, toStatus: string) {
  const formData = new FormData();
  formData.set('recordId', 'maintenance-1');
  formData.set('fromStatus', fromStatus);
  formData.set('toStatus', toStatus);
  return formData;
}

describe('действия технического обслуживания', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedSession.mockResolvedValue(session);
    repository.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      positions: [{ odometerKm: { toString: () => '12345.6' } }],
    });
    repository.maintenanceRecord.create.mockResolvedValue({ id: 'maintenance-1' });
    repository.maintenanceRecord.updateMany.mockResolvedValue({ count: 1 });
  });

  it('требует сессию для создания ТО', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(createMaintenanceAction(initialState, validFormData())).resolves.toEqual({
      status: 'error',
      message: 'Сессия истекла. Войдите снова.',
    });
    expect(repository.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it('создаёт ТО только для автомобиля компании администратора', async () => {
    repository.vehicle.findFirst.mockResolvedValue(null);

    const state = await createMaintenanceAction(initialState, validFormData());

    expect(state).toEqual({ status: 'error', message: 'Автомобиль недоступен.' });
    expect(repository.vehicle.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'vehicle-1',
        company: { members: { some: { userId: 'user-1' } } },
      },
      select: {
        id: true,
        positions: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { odometerKm: true },
        },
      },
    });
    expect(repository.maintenanceRecord.create).not.toHaveBeenCalled();
  });

  it('создаёт запланированное ТО после проверки компании', async () => {
    await expect(createMaintenanceAction(initialState, validFormData())).resolves.toEqual({
      status: 'success',
      message: 'ТО запланировано.',
    });
    expect(repository.maintenanceRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: 'vehicle-1',
        title: 'Замена масла',
        kind: 'OIL',
        status: 'PLANNED',
        targetOdometerKm: 15000,
        odometerKm: 12345.6,
        costMinor: 420000,
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/maintenance');
  });

  it('атомарно переводит эффективную просрочку только из PLANNED с прошедшей датой', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-24T12:00:00.000Z'));

    await transitionMaintenanceAction(initialState, transitionFormData('OVERDUE', 'IN_PROGRESS'));

    expect(repository.maintenanceRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'maintenance-1',
        status: 'PLANNED',
        scheduledAt: { lt: new Date('2026-07-24T12:00:00.000Z') },
        vehicle: { company: { members: { some: { userId: 'user-1' } } } },
      },
      data: { status: 'IN_PROGRESS' },
    });
    vi.useRealTimers();
  });

  it('отклоняет недопустимый переход до записи в базу', async () => {
    await expect(
      transitionMaintenanceAction(initialState, transitionFormData('COMPLETED', 'IN_PROGRESS')),
    ).resolves.toEqual({ status: 'error', message: 'Недопустимый переход статуса ТО.' });
    expect(repository.maintenanceRecord.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('требует сессию для перехода статуса ТО', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(
      transitionMaintenanceAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS')),
    ).resolves.toEqual({ status: 'error', message: 'Сессия истекла. Войдите снова.' });
    expect(repository.maintenanceRecord.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('для перехода в работу обновляет только статус без отсутствующего startedAt', async () => {
    await transitionMaintenanceAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS'));

    expect(repository.maintenanceRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'IN_PROGRESS' } }),
    );
  });

  it('атомарно обновляет только доступную запись с ожидаемым текущим статусом', async () => {
    await expect(
      transitionMaintenanceAction(initialState, transitionFormData('IN_PROGRESS', 'COMPLETED')),
    ).resolves.toEqual({ status: 'success', message: 'Статус ТО обновлён.' });
    expect(repository.maintenanceRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'maintenance-1',
        status: 'IN_PROGRESS',
        vehicle: { company: { members: { some: { userId: 'user-1' } } } },
      },
      data: { status: 'COMPLETED', completedAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/maintenance');
  });

  it('не раскрывает чужую или уже изменившуюся запись и не обновляет маршрут', async () => {
    repository.maintenanceRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionMaintenanceAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS')),
    ).resolves.toEqual({
      status: 'error',
      message: 'Запись ТО недоступна или уже изменилась.',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
