import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDeviceDetails: vi.fn(),
  getAvailableVehicles: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/modules/devices/server/queries', () => ({
  getDeviceDetails: mocks.getDeviceDetails,
  getAvailableVehicles: mocks.getAvailableVehicles,
}));
vi.mock('@/modules/devices/components/DeviceDetailPage', () => ({
  DeviceDetailPage: () => null,
}));
vi.mock('@/shared/components/app-shell/AppShell', () => ({ AppShell: () => null }));

import DeviceRoute from './page';

describe('маршрут детальной страницы устройства', () => {
  it('возвращает 404, если устройство не принадлежит текущей компании', async () => {
    const notFoundSignal = new Error('not found');
    mocks.getDeviceDetails.mockResolvedValue(null);
    mocks.notFound.mockImplementation(() => {
      throw notFoundSignal;
    });

    await expect(DeviceRoute({ params: Promise.resolve({ id: 'foreign-device' }) })).rejects.toBe(
      notFoundSignal,
    );
    expect(mocks.getAvailableVehicles).not.toHaveBeenCalled();
  });
});
