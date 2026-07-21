import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn() }));
const repository = vi.hoisted(() => ({
  vehicle: { findFirst: vi.fn() },
  washRecord: { create: vi.fn(), updateMany: vi.fn() },
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
}));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));

import { createWashAction, transitionWashAction } from './actions';

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
  formData.set('kind', 'COMPLEX');
  formData.set('scheduledAt', '2026-07-23T10:00');
  formData.set('provider', 'Мойка Pilot');
  formData.set('costRubles', '1900');
  formData.set('notes', 'Комплексная мойка');
  return formData;
}

function transitionFormData(fromStatus: string, toStatus: string) {
  const formData = new FormData();
  formData.set('recordId', 'wash-1');
  formData.set('fromStatus', fromStatus);
  formData.set('toStatus', toStatus);
  return formData;
}

describe('действия мойки', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedSession.mockResolvedValue(session);
    repository.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1' });
    repository.washRecord.create.mockResolvedValue({ id: 'wash-1' });
    repository.washRecord.updateMany.mockResolvedValue({ count: 1 });
  });

  it('требует сессию для создания мойки', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(createWashAction(initialState, validFormData())).resolves.toEqual({
      status: 'error',
      message: 'Сессия истекла. Войдите снова.',
    });
    expect(repository.vehicle.findFirst).not.toHaveBeenCalled();
  });

  it('создаёт мойку только для автомобиля компании администратора', async () => {
    repository.vehicle.findFirst.mockResolvedValue(null);

    const state = await createWashAction(initialState, validFormData());

    expect(state).toEqual({ status: 'error', message: 'Автомобиль недоступен.' });
    expect(repository.vehicle.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'vehicle-1',
        company: { members: { some: { userId: 'user-1' } } },
      },
      select: { id: true },
    });
    expect(repository.washRecord.create).not.toHaveBeenCalled();
  });

  it('создаёт запланированную мойку после проверки компании', async () => {
    await expect(createWashAction(initialState, validFormData())).resolves.toEqual({
      status: 'success',
      message: 'Мойка запланирована.',
    });
    expect(repository.washRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: 'vehicle-1',
        kind: 'COMPLEX',
        status: 'PLANNED',
        costMinor: 190000,
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/wash');
  });

  it('требует сессию для перехода статуса мойки', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(
      transitionWashAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS')),
    ).resolves.toEqual({ status: 'error', message: 'Сессия истекла. Войдите снова.' });
    expect(repository.washRecord.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('отклоняет недопустимый переход до записи в базу', async () => {
    await expect(
      transitionWashAction(initialState, transitionFormData('COMPLETED', 'CANCELLED')),
    ).resolves.toEqual({ status: 'error', message: 'Недопустимый переход статуса мойки.' });
    expect(repository.washRecord.updateMany).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('атомарно начинает только доступную запись с ожидаемым текущим статусом', async () => {
    await expect(
      transitionWashAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS')),
    ).resolves.toEqual({ status: 'success', message: 'Статус мойки обновлён.' });
    expect(repository.washRecord.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'wash-1',
        status: 'PLANNED',
        vehicle: { company: { members: { some: { userId: 'user-1' } } } },
      },
      data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/wash');
  });

  it('проставляет время завершения мойки', async () => {
    await transitionWashAction(initialState, transitionFormData('IN_PROGRESS', 'COMPLETED'));

    expect(repository.washRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      }),
    );
  });

  it('не раскрывает чужую или уже изменившуюся запись', async () => {
    repository.washRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transitionWashAction(initialState, transitionFormData('PLANNED', 'IN_PROGRESS')),
    ).resolves.toEqual({
      status: 'error',
      message: 'Запись мойки недоступна или уже изменилась.',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('возвращает безопасную ошибку при сбое репозитория', async () => {
    repository.washRecord.create.mockRejectedValue(new Error('database unavailable'));

    await expect(createWashAction(initialState, validFormData())).resolves.toEqual({
      status: 'error',
      message: 'Не удалось сохранить мойку.',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
