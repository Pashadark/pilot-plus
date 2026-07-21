import { describe, expect, it } from 'vitest';

import { createMaintenanceQueries } from './queries';

const record = {
  id: 'maintenance-1',
  vehicleId: 'vehicle-1',
  title: 'Замена масла',
  kind: 'OIL',
  status: 'PLANNED',
  scheduledAt: new Date('2026-07-23T10:00:00.000Z'),
  completedAt: null,
  description: 'Описание из старой схемы',
  odometerKm: { toString: () => '10000.0' },
  targetOdometerKm: { toString: () => '15000.5' },
  provider: 'Сервис Pilot',
  costMinor: 420000,
  notes: null,
  createdAt: new Date('2026-07-21T10:00:00.000Z'),
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: 'А001АА',
    positions: [{ odometerKm: { toString: () => '12000.0' } }],
  },
};

describe('запросы технического обслуживания', () => {
  it('читает записи только автомобилей компании пользователя', async () => {
    let receivedArgs: unknown;
    const queries = createMaintenanceQueries({
      async findMany(args: unknown) {
        receivedArgs = args;
        return [record];
      },
    });

    const records = await queries.listMaintenanceForUser(
      'user-1',
      new Date('2026-07-24T10:00:00.000Z'),
    );

    expect(receivedArgs).toMatchObject({
      where: { vehicle: { company: { members: { some: { userId: 'user-1' } } } } },
      take: 200,
    });
    expect(records).toEqual([
      expect.objectContaining({
        id: 'maintenance-1',
        targetOdometerKm: 15000.5,
        odometerKm: 10000,
        currentOdometerKm: 12000,
        status: 'OVERDUE',
        notes: 'Описание из старой схемы',
        scheduledAt: '2026-07-23T10:00:00.000Z',
        vehicle: {
          id: 'vehicle-1',
          internalNumber: 'PLT-001',
          model: 'GWM WEY',
          registrationNumber: 'А001АА',
        },
      }),
    ]);
  });

  it('возвращает пустой список, когда доступных записей нет', async () => {
    const queries = createMaintenanceQueries({
      async findMany() {
        return [];
      },
    });

    await expect(queries.listMaintenanceForUser('user-1')).resolves.toEqual([]);
  });
});
