import { describe, expect, it } from 'vitest';

import { createWashQueries } from './queries';

const record = {
  id: 'wash-1',
  vehicleId: 'vehicle-1',
  kind: 'COMPLEX',
  status: 'PLANNED',
  scheduledAt: new Date('2026-07-23T10:00:00.000Z'),
  startedAt: null,
  completedAt: null,
  provider: 'Мойка Pilot',
  costMinor: 190000,
  notes: 'Комплексная мойка',
  createdAt: new Date('2026-07-21T10:00:00.000Z'),
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: 'А001АА',
  },
};

describe('запросы моек', () => {
  it('читает записи только автомобилей компании пользователя', async () => {
    let receivedArgs: unknown;
    const queries = createWashQueries({
      async findMany(args: unknown) {
        receivedArgs = args;
        return [record];
      },
    });

    const records = await queries.listWashRecordsForUser('user-1');

    expect(receivedArgs).toMatchObject({
      where: { vehicle: { company: { members: { some: { userId: 'user-1' } } } } },
    });
    expect(records).toEqual([
      expect.objectContaining({
        id: 'wash-1',
        scheduledAt: '2026-07-23T10:00:00.000Z',
        startedAt: null,
        completedAt: null,
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
    const queries = createWashQueries({
      async findMany() {
        return [];
      },
    });

    await expect(queries.listWashRecordsForUser('user-1')).resolves.toEqual([]);
  });
});
