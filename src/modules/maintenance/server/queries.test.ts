import { describe, expect, it } from 'vitest';

import { createMaintenanceQueries, createRepairRentalOptionsQuery } from './queries';

const record = {
  id: 'maintenance-1',
  vehicleId: 'vehicle-1',
  title: 'Замена масла',
  recordType: 'MAINTENANCE',
  kind: 'OIL',
  status: 'PLANNED',
  scheduledAt: new Date('2026-07-23T10:00:00.000Z'),
  completedAt: null,
  damageReportedAt: null,
  startedAt: null,
  description: 'Описание из старой схемы',
  odometerKm: { toString: () => '10000.0' },
  targetOdometerKm: { toString: () => '15000.5' },
  provider: 'Сервис Pilot',
  costMinor: 420000,
  notes: null,
  createdAt: new Date('2026-07-21T10:00:00.000Z'),
  rental: null,
  client: null,
  workItems: [],
  attachments: [],
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: 'А001АА',
    odometerKm: null,
    positions: [{ odometerKm: { toString: () => '12000.0' } }],
    images: [{ localPath: '/vehicles/vehicle-1/images/photo-1' }],
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
          imagePath: '/vehicles/vehicle-1/images/photo-1',
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

  it('возвращает безопасные данные ремонта без ключей приватного хранилища', async () => {
    const queries = createMaintenanceQueries({
      async findMany() {
        return [
          {
            ...record,
            id: 'repair-1',
            title: 'Повреждение задней части кузова',
            recordType: 'REPAIR',
            status: 'IN_PROGRESS',
            damageReportedAt: new Date('2026-09-12T09:00:00.000Z'),
            startedAt: new Date('2026-09-12T10:00:00.000Z'),
            scheduledAt: null,
            rental: { id: 'rental-1', contractNumber: 'ME-2026-0030-GA' },
            client: {
              id: 'client-1',
              firstName: 'Артём',
              middleName: 'Денисович',
              lastName: 'Горбунов',
            },
            workItems: [
              {
                id: 'work-1',
                title: 'Диагностика',
                description: null,
                costMinor: null,
                position: 0,
              },
            ],
            attachments: [
              {
                id: 'photo-1',
                kind: 'DAMAGE_BEFORE',
                originalName: 'damage.jpg',
                verifiedMime: 'image/jpeg',
                bytes: 1200,
                caption: null,
                createdAt: new Date('2026-09-12T10:00:00.000Z'),
                storageKey: 'private/secret.jpg',
                sha256: 'a'.repeat(64),
              },
            ],
          },
        ];
      },
    });

    const [result] = await queries.listMaintenanceForUser('user-1');

    expect(result).toMatchObject({
      recordType: 'REPAIR',
      damageReportedAt: '2026-09-12T09:00:00.000Z',
      rental: { id: 'rental-1', contractNumber: 'ME-2026-0030-GA' },
      client: { id: 'client-1', fullName: 'Горбунов Артём Денисович' },
      workItems: [{ id: 'work-1', title: 'Диагностика', position: 0 }],
      attachments: [
        expect.objectContaining({
          id: 'photo-1',
          kind: 'DAMAGE_BEFORE',
          url: '/maintenance/repair-1/attachments/photo-1',
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain('private/secret.jpg');
    expect(JSON.stringify(result)).not.toContain('a'.repeat(64));
  });

  it('использует сохранённый пробег автомобиля, когда GPS не передаёт одометр', async () => {
    const queries = createMaintenanceQueries({
      async findMany() {
        return [
          {
            ...record,
            vehicle: {
              ...record.vehicle,
              odometerKm: { toString: () => '83273.0' },
              positions: [{ odometerKm: null }],
            },
          },
        ];
      },
    });

    const [result] = await queries.listMaintenanceForUser('user-1');

    expect(result?.currentOdometerKm).toBe(83273);
  });
});

describe('варианты договоров для ремонта', () => {
  it('возвращает только договоры доступной компании с подписью клиента', async () => {
    let receivedArgs: unknown;
    const listOptions = createRepairRentalOptionsQuery({
      async findMany(args: unknown) {
        receivedArgs = args;
        return [
          {
            id: 'rental-1',
            vehicleId: 'vehicle-1',
            contractNumber: 'ME-2026-0030-GA',
            startsAt: new Date('2026-09-01T10:00:00.000Z'),
            client: { firstName: 'Артём', middleName: 'Денисович', lastName: 'Горбунов' },
          },
        ];
      },
    });

    await expect(listOptions('user-1')).resolves.toEqual([
      {
        id: 'rental-1',
        vehicleId: 'vehicle-1',
        label: 'ME-2026-0030-GA · Горбунов Артём Денисович',
      },
    ]);
    expect(receivedArgs).toMatchObject({
      where: { company: { members: { some: { userId: 'user-1' } } } },
    });
  });
});
