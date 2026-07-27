import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePathMock = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({ getAuthenticatedSession: vi.fn() }));
const transaction = vi.hoisted(() => ({
  device: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  vehicle: { findFirst: vi.fn() },
  firmwareRelease: { findFirst: vi.fn() },
  deviceCommand: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
}));
const repository = vi.hoisted(() => ({
  companyMember: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/services/auth/session', () => ({
  getAuthenticatedSession: authMocks.getAuthenticatedSession,
}));
vi.mock('@/database/prisma/client', () => ({ prisma: repository }));

import {
  bindDeviceAction,
  cancelDeviceCommandAction,
  createDeviceAction,
  createDeviceCommandAction,
} from './actions';

const initialState = { success: false, message: '' };
const session = {
  user: { id: 'user-1', email: 'admin@example.com', name: 'Администратор', role: 'ADMIN' as const },
  currentSessionId: 'session-1',
  currentSessionTokenHash: 'token-hash',
  currentSessionExpiresAt: new Date('2026-07-28T00:00:00.000Z'),
};

function createDeviceForm(vehicleId?: string) {
  const formData = new FormData();
  formData.set('name', 'Pilot Connect 0147');
  formData.set('serialNumber', 'PC-0147-A');
  formData.set('imei', '123456789012345');
  formData.set('hardwareVersion', '1.0.0');
  formData.set('firmwareVersion', '2.4.0');
  if (vehicleId) formData.set('vehicleId', vehicleId);
  return formData;
}

function bindForm(deviceId: string, vehicleId: string | null) {
  const formData = new FormData();
  formData.set('deviceId', deviceId);
  formData.set('vehicleId', vehicleId ?? '');
  return formData;
}

function commandForm(type: 'REBOOT' | 'SHUTDOWN' | 'UPDATE_FIRMWARE') {
  const formData = new FormData();
  formData.set('deviceId', 'device-1');
  formData.set('type', type);
  if (type === 'UPDATE_FIRMWARE') formData.set('firmwareReleaseId', 'firmware-241');
  return formData;
}

function cancelForm(commandId = 'command-1') {
  const formData = new FormData();
  formData.set('commandId', commandId);
  return formData;
}

describe('действия Pilot Connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getAuthenticatedSession.mockResolvedValue(session);
    repository.companyMember.findFirst.mockResolvedValue({ companyId: 'company-1' });
    repository.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction),
    );
    transaction.device.create.mockResolvedValue({ id: 'device-1' });
    transaction.device.findFirst.mockResolvedValue({
      id: 'device-1',
      companyId: 'company-1',
      firmwareVersion: '2.4.0',
    });
    transaction.device.updateMany.mockResolvedValue({ count: 1 });
    transaction.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1', device: null });
    transaction.firmwareRelease.findFirst.mockResolvedValue({
      id: 'firmware-241',
      version: '2.4.1',
    });
    transaction.deviceCommand.findFirst.mockResolvedValue(null);
    transaction.deviceCommand.create.mockResolvedValue({ id: 'command-1' });
    transaction.deviceCommand.updateMany.mockResolvedValue({ count: 1 });
  });

  it('требует сессию до любой мутации', async () => {
    authMocks.getAuthenticatedSession.mockResolvedValue(null);

    await expect(createDeviceAction(initialState, createDeviceForm())).resolves.toEqual({
      success: false,
      message: 'Сессия истекла. Войдите снова.',
    });
    expect(repository.companyMember.findFirst).not.toHaveBeenCalled();
    expect(repository.$transaction).not.toHaveBeenCalled();
  });

  it('не создаёт устройство с дублирующимся серийным номером без раскрытия ошибки базы', async () => {
    transaction.device.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['serialNumber'] },
    });

    await expect(createDeviceAction(initialState, createDeviceForm())).resolves.toEqual({
      success: false,
      message: 'Не удалось добавить устройство. Проверьте данные.',
      fieldErrors: { serialNumber: ['Серийный номер уже используется.'] },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('не создаёт устройство с дублирующимся IMEI без раскрытия ошибки базы', async () => {
    transaction.device.create.mockRejectedValue({ code: 'P2002', meta: { target: ['imei'] } });

    await expect(createDeviceAction(initialState, createDeviceForm())).resolves.toEqual({
      success: false,
      message: 'Не удалось добавить устройство. Проверьте данные.',
      fieldErrors: { imei: ['IMEI уже используется.'] },
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('не связывает новое устройство с автомобилем другой компании', async () => {
    transaction.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      createDeviceAction(initialState, createDeviceForm('foreign-vehicle')),
    ).resolves.toEqual({
      success: false,
      message: 'Автомобиль недоступен.',
    });
    expect(transaction.device.create).not.toHaveBeenCalled();
  });

  it('изменяет только устройство текущей компании при привязке', async () => {
    transaction.device.findFirst.mockResolvedValue(null);

    await expect(
      bindDeviceAction(initialState, bindForm('foreign-device', 'vehicle-1')),
    ).resolves.toEqual({
      success: false,
      message: 'Устройство недоступно.',
    });
    expect(transaction.vehicle.findFirst).not.toHaveBeenCalled();
    expect(transaction.device.updateMany).not.toHaveBeenCalled();
  });

  it('не привязывает устройство к автомобилю, занятому другим Pilot Connect', async () => {
    transaction.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      device: { id: 'device-2' },
    });

    await expect(
      bindDeviceAction(initialState, bindForm('device-1', 'vehicle-1')),
    ).resolves.toEqual({
      success: false,
      message: 'К этому автомобилю уже привязано устройство Pilot Connect.',
    });
    expect(transaction.device.updateMany).not.toHaveBeenCalled();
  });

  it('атомарно привязывает устройство к автомобилю текущей компании', async () => {
    await expect(
      bindDeviceAction(initialState, bindForm('device-1', 'vehicle-1')),
    ).resolves.toEqual({
      success: true,
      message: 'Автомобиль привязан к устройству.',
    });
    expect(transaction.device.findFirst).toHaveBeenCalledWith({
      where: { id: 'device-1', companyId: 'company-1' },
      select: { id: true, vehicleId: true },
    });
    expect(transaction.vehicle.findFirst).toHaveBeenCalledWith({
      where: { id: 'vehicle-1', companyId: 'company-1' },
      select: { id: true, device: { select: { id: true } } },
    });
    expect(transaction.device.updateMany).toHaveBeenCalledWith({
      where: { id: 'device-1', companyId: 'company-1' },
      data: { vehicleId: 'vehicle-1' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices');
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices/device-1');
  });

  it('не ставит конфликтующую команду в очередь, пока есть PENDING или SENT', async () => {
    transaction.deviceCommand.findFirst.mockResolvedValue({ id: 'active-command' });

    await expect(createDeviceCommandAction(initialState, commandForm('REBOOT'))).resolves.toEqual({
      success: false,
      message: 'Для устройства уже выполняется команда.',
    });
    expect(transaction.deviceCommand.create).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('создаёт только очередь обновления до доступной новой прошивки с автором и payload', async () => {
    await expect(
      createDeviceCommandAction(initialState, commandForm('UPDATE_FIRMWARE')),
    ).resolves.toEqual({
      success: true,
      message: 'Команда обновления прошивки добавлена в очередь.',
    });
    expect(transaction.deviceCommand.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        deviceId: 'device-1',
        status: { in: ['PENDING', 'SENT'] },
      },
      select: { id: true },
    });
    expect(transaction.firmwareRelease.findFirst).toHaveBeenCalledWith({
      where: { id: 'firmware-241' },
      select: { id: true, version: true },
    });
    expect(transaction.deviceCommand.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        deviceId: 'device-1',
        createdByUserId: 'user-1',
        type: 'UPDATE_FIRMWARE',
        status: 'PENDING',
        firmwareReleaseId: 'firmware-241',
        targetFirmwareVersion: '2.4.1',
        payload: { command: 'update_firmware', version: '2.4.1' },
      },
    });
    expect(repository.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices');
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices/device-1');
  });

  it('отклоняет конкурирующую сериализуемую транзакцию как конфликт активной команды', async () => {
    repository.$transaction.mockRejectedValueOnce({ code: 'P2034' });

    await expect(createDeviceCommandAction(initialState, commandForm('REBOOT'))).resolves.toEqual({
      success: false,
      message: 'Для устройства уже выполняется команда.',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it('не ставит обновление до текущей или более старой прошивки в очередь', async () => {
    transaction.firmwareRelease.findFirst.mockResolvedValue({
      id: 'firmware-241',
      version: '2.4.0',
    });

    await expect(
      createDeviceCommandAction(initialState, commandForm('UPDATE_FIRMWARE')),
    ).resolves.toEqual({
      success: false,
      message: 'Выбранная версия прошивки недоступна.',
    });
    expect(transaction.deviceCommand.create).not.toHaveBeenCalled();
  });

  it('отменяет только ожидающую команду своей компании', async () => {
    transaction.deviceCommand.findFirst.mockResolvedValue({ deviceId: 'device-1' });

    await expect(cancelDeviceCommandAction(initialState, cancelForm())).resolves.toEqual({
      success: true,
      message: 'Команда отменена.',
    });
    expect(transaction.deviceCommand.updateMany).toHaveBeenCalledWith({
      where: { id: 'command-1', companyId: 'company-1', status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices');
    expect(revalidatePathMock).toHaveBeenCalledWith('/devices/device-1');
  });

  it('не отменяет уже отправленную или чужую команду', async () => {
    transaction.deviceCommand.findFirst.mockResolvedValue({ deviceId: 'device-1' });
    transaction.deviceCommand.updateMany.mockResolvedValue({ count: 0 });

    await expect(cancelDeviceCommandAction(initialState, cancelForm())).resolves.toEqual({
      success: false,
      message: 'Команда недоступна или уже отправлена.',
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
