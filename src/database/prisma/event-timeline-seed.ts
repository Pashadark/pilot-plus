import type { PrismaClient } from './../generated/prisma';

export type EventTimelineSeedDatabase = {
  trip: Pick<PrismaClient['trip'], 'upsert'>;
  vehicleEvent: Pick<PrismaClient['vehicleEvent'], 'upsert'>;
  fuelRecord: Pick<PrismaClient['fuelRecord'], 'upsert'>;
  manualVehicleEvent: Pick<PrismaClient['manualVehicleEvent'], 'upsert'>;
};

type SeedVehicle = { id: string; internalNumber: string };

type TripDefinition = {
  vehicleNumber: number;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  averageSpeedKph: number;
  maximumSpeedKph: number;
  fuelUsedLiters: number;
};

type VehicleEventDefinition = {
  vehicleNumber: number;
  type: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
  title: string;
  description: string;
  location: string;
  recordedAt: string;
};

type FuelRecordDefinition = {
  vehicleNumber: number;
  type: string;
  volumeLiters: number | null;
  levelPercent: number;
  consumption: number | null;
  recordedAt: string;
};

type ManualEventDefinition = {
  vehicleNumber: number;
  kind: 'NOTE' | 'INCIDENT' | 'ASSIGNMENT';
  severity: 'INFO' | 'WARNING' | 'DANGER';
  title: string;
  description: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string;
};

const stableId = (kind: string, internalNumber: string, index: number) =>
  `seed-${kind}-${internalNumber.toLowerCase()}-${String(index).padStart(2, '0')}`;

const fixedDate = (timestamp: string) => new Date(timestamp);

const TRIP_ROWS = [
  [1, '2026-07-03T05:20:00.000Z', '2026-07-03T06:05:00.000Z', 31.4, 2700, 42, 76, 3.8],
  [2, '2026-07-04T08:10:00.000Z', '2026-07-04T09:00:00.000Z', 38.7, 3000, 46, 82, 4.4],
  [3, '2026-07-05T11:30:00.000Z', '2026-07-05T12:20:00.000Z', 27.1, 3000, 33, 68, 3.2],
  [4, '2026-07-06T04:45:00.000Z', '2026-07-06T05:55:00.000Z', 54.6, 4200, 47, 91, 6.5],
  [5, '2026-07-07T07:15:00.000Z', '2026-07-07T08:05:00.000Z', 35.9, 3000, 43, 79, 4.1],
  [6, '2026-07-08T10:40:00.000Z', '2026-07-08T11:25:00.000Z', 24.8, 2700, 33, 64, 3.1],
  [7, '2026-07-09T06:50:00.000Z', '2026-07-09T07:40:00.000Z', 40.2, 3000, 48, 85, 4.7],
  [8, '2026-07-10T09:05:00.000Z', '2026-07-10T10:10:00.000Z', 47.3, 3900, 44, 88, 5.6],
  [9, '2026-07-11T12:20:00.000Z', '2026-07-11T13:00:00.000Z', 22.6, 2400, 34, 62, 2.8],
  [10, '2026-07-12T05:30:00.000Z', '2026-07-12T06:25:00.000Z', 41.8, 3300, 46, 84, 4.9],
  [11, '2026-07-13T08:35:00.000Z', '2026-07-13T09:20:00.000Z', 29.3, 2700, 39, 72, 3.5],
  [12, '2026-07-14T11:15:00.000Z', '2026-07-14T12:20:00.000Z', 51.7, 3900, 48, 93, 6.1],
  [13, '2026-07-15T07:40:00.000Z', '2026-07-15T08:30:00.000Z', 36.1, 3000, 43, 81, 4.3],
  [14, '2026-07-16T10:00:00.000Z', '2026-07-16T10:50:00.000Z', 33.5, 3000, 40, 74, 3.9],
  [15, '2026-07-17T05:55:00.000Z', '2026-07-17T07:10:00.000Z', 57.2, 4500, 46, 89, 6.8],
  [16, '2026-07-18T09:25:00.000Z', '2026-07-18T10:05:00.000Z', 26.4, 2400, 40, 70, 3.1],
  [17, '2026-07-19T11:05:00.000Z', '2026-07-19T12:05:00.000Z', 44.9, 3600, 45, 86, 5.3],
  [18, '2026-07-20T06:15:00.000Z', '2026-07-20T07:00:00.000Z', 30.7, 2700, 41, 73, 3.6],
] as const satisfies readonly (readonly [
  number,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
])[];

const TRIPS: readonly TripDefinition[] = TRIP_ROWS.map(
  ([
    vehicleNumber,
    startedAt,
    endedAt,
    distanceKm,
    durationSeconds,
    averageSpeedKph,
    maximumSpeedKph,
    fuelUsedLiters,
  ]) => ({
    vehicleNumber,
    startedAt,
    endedAt,
    distanceKm,
    durationSeconds,
    averageSpeedKph,
    maximumSpeedKph,
    fuelUsedLiters,
  }),
);

const VEHICLE_EVENT_ROWS = [
  [
    1,
    'MOVEMENT_STARTED',
    'INFO',
    'Начало движения',
    'Автомобиль выехал на маршрут.',
    'Красноярск, проспект Мира, 91',
    '2026-07-03T05:20:00.000Z',
  ],
  [
    1,
    'PARKING_STOP',
    'INFO',
    'Остановка у офиса',
    'Стоянка завершена после выдачи автомобиля.',
    'Красноярск, улица Дубровинского, 100',
    '2026-07-03T06:10:00.000Z',
  ],
  [
    2,
    'SPEEDING',
    'WARNING',
    'Превышение скорости',
    'Зафиксирована скорость 82 км/ч при ограничении 60 км/ч.',
    'Красноярск, улица 9 Мая, 77',
    '2026-07-04T08:42:00.000Z',
  ],
  [
    3,
    'IGNITION_ON',
    'INFO',
    'Зажигание включено',
    'Автомобиль подготовлен к очередной поездке.',
    'Красноярск, улица Карла Маркса, 123',
    '2026-07-05T11:25:00.000Z',
  ],
  [
    4,
    'GEOFENCE_EXIT',
    'INFO',
    'Выезд из геозоны',
    'Автомобиль покинул территорию станции.',
    'Красноярск, Северное шоссе, 17',
    '2026-07-06T04:45:00.000Z',
  ],
  [
    5,
    'LOW_BATTERY',
    'WARNING',
    'Низкий заряд резервной батареи',
    'Заряд резервной батареи устройства снизился до 18%.',
    'Красноярск, улица Авиаторов, 41',
    '2026-07-07T07:55:00.000Z',
  ],
  [
    6,
    'GPS_SIGNAL_LOST',
    'WARNING',
    'Потеря GPS-сигнала',
    'Устройство не передавало координаты более пяти минут.',
    'Красноярск, Коммунальный мост',
    '2026-07-08T11:05:00.000Z',
  ],
  [
    7,
    'HARSH_BRAKING',
    'WARNING',
    'Резкое торможение',
    'Зафиксировано резкое торможение на мокром покрытии.',
    'Красноярск, улица Маерчака, 45',
    '2026-07-09T07:18:00.000Z',
  ],
  [
    8,
    'CRASH_DETECTED',
    'DANGER',
    'Зафиксирован удар',
    'Датчик ускорения зафиксировал сильный удар; требуется проверка автомобиля.',
    'Красноярск, улица Партизана Железняка, 19',
    '2026-07-10T09:48:00.000Z',
  ],
  [
    9,
    'UNAUTHORIZED_MOVEMENT',
    'DANGER',
    'Движение вне согласованного окна',
    'Автомобиль начал движение в период запрета эксплуатации.',
    'Красноярск, улица Взлётная, 24',
    '2026-07-11T12:20:00.000Z',
  ],
  [
    10,
    'GEOFENCE_ENTER',
    'INFO',
    'Въезд на парковку',
    'Автомобиль вернулся в разрешённую геозону.',
    'Красноярск, улица Шахтёров, 49Ж',
    '2026-07-12T06:28:00.000Z',
  ],
  [
    11,
    'ENGINE_IDLE',
    'WARNING',
    'Длительная работа на холостом ходу',
    'Двигатель работал без движения более 15 минут.',
    'Красноярск, улица Белинского, 8',
    '2026-07-13T09:10:00.000Z',
  ],
  [
    12,
    'TOWING_DETECTED',
    'DANGER',
    'Обнаружена эвакуация',
    'Перемещение автомобиля зафиксировано при выключенном зажигании.',
    'Красноярск, улица Ленина, 110',
    '2026-07-14T11:40:00.000Z',
  ],
  [
    13,
    'CONNECTION_RESTORED',
    'INFO',
    'Связь с устройством восстановлена',
    'Pilot Connect снова передаёт данные.',
    'Красноярск, улица Республики, 51',
    '2026-07-15T08:05:00.000Z',
  ],
  [
    14,
    'SPEEDING',
    'WARNING',
    'Превышение скорости',
    'Зафиксирована скорость 74 км/ч при ограничении 60 км/ч.',
    'Красноярск, улица Калинина, 90',
    '2026-07-16T10:20:00.000Z',
  ],
  [
    15,
    'MOVEMENT_STARTED',
    'INFO',
    'Начало движения',
    'Автомобиль выехал после технического осмотра.',
    'Красноярск, улица Брянская, 140',
    '2026-07-17T05:55:00.000Z',
  ],
  [
    16,
    'PARKING_STOP',
    'INFO',
    'Остановка у клиента',
    'Автомобиль находится на кратковременной стоянке.',
    'Красноярск, улица Сурикова, 12',
    '2026-07-18T09:45:00.000Z',
  ],
  [
    17,
    'DOOR_OPEN',
    'WARNING',
    'Дверь открыта при включённом зажигании',
    'Проверьте, что пассажиры безопасно покинули автомобиль.',
    'Красноярск, улица Высотная, 2',
    '2026-07-19T11:42:00.000Z',
  ],
  [
    18,
    'IGNITION_OFF',
    'INFO',
    'Зажигание выключено',
    'Поездка завершена, автомобиль поставлен на стоянку.',
    'Красноярск, улица Копылова, 74',
    '2026-07-20T07:04:00.000Z',
  ],
  [
    19,
    'FUEL_LEVEL_DROP',
    'WARNING',
    'Резкое снижение уровня топлива',
    'За десять минут уровень топлива снизился на 18%.',
    'Красноярск, улица Гайдашовка, 3',
    '2026-07-21T04:30:00.000Z',
  ],
  [
    20,
    'GEOFENCE_EXIT',
    'INFO',
    'Выезд из геозоны',
    'Автомобиль покинул территорию сервисного центра.',
    'Красноярск, улица Телевизорная, 1',
    '2026-07-22T08:15:00.000Z',
  ],
  [
    21,
    'DEVICE_OFFLINE',
    'WARNING',
    'Устройство вне сети',
    'Нет связи с Pilot Connect более 30 минут.',
    'Красноярск, Енисейский тракт, 5 км',
    '2026-07-23T10:00:00.000Z',
  ],
  [
    22,
    'CONNECTION_RESTORED',
    'INFO',
    'Связь с устройством восстановлена',
    'Передача телеметрии возобновлена после проверки сети.',
    'Красноярск, улица Молокова, 1',
    '2026-07-24T07:45:00.000Z',
  ],
  [
    23,
    'PARKING_STOP',
    'INFO',
    'Остановка на парковке',
    'Автомобиль припаркован в разрешённой зоне.',
    'Красноярск, улица Весны, 7Д',
    '2026-07-25T06:30:00.000Z',
  ],
] as const satisfies readonly (readonly [
  number,
  string,
  'INFO' | 'WARNING' | 'DANGER',
  string,
  string,
  string,
  string,
])[];

const VEHICLE_EVENTS: readonly VehicleEventDefinition[] = VEHICLE_EVENT_ROWS.map(
  ([vehicleNumber, type, severity, title, description, location, recordedAt]) => ({
    vehicleNumber,
    type,
    severity,
    title,
    description,
    location,
    recordedAt,
  }),
);

const FUEL_RECORD_ROWS = [
  [1, 'REFUEL', 42.6, 84, 8.1, '2026-07-03T04:55:00.000Z'],
  [3, 'REFUEL', 38.1, 79, 7.8, '2026-07-05T10:50:00.000Z'],
  [5, 'LEVEL_CHANGE', null, 61, 8.4, '2026-07-07T06:40:00.000Z'],
  [7, 'REFUEL', 45.2, 88, 8.6, '2026-07-09T06:20:00.000Z'],
  [9, 'REFUEL', 31.7, 73, 7.5, '2026-07-11T11:55:00.000Z'],
  [11, 'LEVEL_CHANGE', null, 54, 8.9, '2026-07-13T08:00:00.000Z'],
  [13, 'REFUEL', 47.3, 91, 8.2, '2026-07-15T07:10:00.000Z'],
  [15, 'REFUEL', 52.4, 94, 8.7, '2026-07-17T05:20:00.000Z'],
  [17, 'REFUEL', 39.6, 81, 8.0, '2026-07-19T10:30:00.000Z'],
  [19, 'DRAIN', 18.2, 42, null, '2026-07-21T04:25:00.000Z'],
  [21, 'LEVEL_CHANGE', null, 49, 9.1, '2026-07-23T09:30:00.000Z'],
  [23, 'REFUEL', 41.8, 86, 8.3, '2026-07-25T05:55:00.000Z'],
] as const satisfies readonly (readonly [
  number,
  string,
  number | null,
  number,
  number | null,
  string,
])[];

const FUEL_RECORDS: readonly FuelRecordDefinition[] = FUEL_RECORD_ROWS.map(
  ([vehicleNumber, type, volumeLiters, levelPercent, consumption, recordedAt]) => ({
    vehicleNumber,
    type,
    volumeLiters,
    levelPercent,
    consumption,
    recordedAt,
  }),
);

const MANUAL_EVENT_ROWS = [
  [
    2,
    'ASSIGNMENT',
    'INFO',
    'Назначен водитель на смену',
    'Автомобиль закреплён за сменой Ивана Крылова.',
    'Красноярск, улица 9 Мая, 77',
    56.050011,
    92.906722,
    '2026-07-04T07:50:00.000Z',
  ],
  [
    4,
    'NOTE',
    'INFO',
    'Принят после мойки',
    'Кузов и салон осмотрены, замечаний нет.',
    'Красноярск, Северное шоссе, 17',
    56.074195,
    92.858701,
    '2026-07-06T04:20:00.000Z',
  ],
  [
    8,
    'INCIDENT',
    'DANGER',
    'Оформлен инцидент после удара',
    'Диспетчер запросил фотографии и передал автомобиль на осмотр.',
    'Красноярск, улица Партизана Железняка, 19',
    56.029742,
    92.916426,
    '2026-07-10T10:05:00.000Z',
  ],
  [
    10,
    'ASSIGNMENT',
    'INFO',
    'Назначена вечерняя подача',
    'Автомобиль подготовлен к выдаче у центрального офиса.',
    'Красноярск, улица Шахтёров, 49Ж',
    56.031319,
    92.899639,
    '2026-07-12T06:10:00.000Z',
  ],
  [
    12,
    'INCIDENT',
    'WARNING',
    'Проверка после сообщения об эвакуации',
    'Связь с водителем установлена, место стоянки подтверждено.',
    'Красноярск, улица Ленина, 110',
    56.012015,
    92.866174,
    '2026-07-14T12:00:00.000Z',
  ],
  [
    16,
    'NOTE',
    'INFO',
    'Переданы ключи на сервис',
    'Ключи и документы переданы мастеру при приёмке.',
    'Красноярск, улица Сурикова, 12',
    56.009461,
    92.868888,
    '2026-07-18T09:15:00.000Z',
  ],
  [
    19,
    'INCIDENT',
    'DANGER',
    'Проверяется возможный слив топлива',
    'Охране передан запрос на запись камер у стоянки.',
    'Красноярск, улица Гайдашовка, 3',
    56.081241,
    92.781565,
    '2026-07-21T04:40:00.000Z',
  ],
  [
    23,
    'ASSIGNMENT',
    'INFO',
    'Назначен утренний осмотр',
    'Ответственный механик подтвердил осмотр перед выдачей.',
    'Красноярск, улица Весны, 7Д',
    56.041814,
    92.907383,
    '2026-07-25T06:15:00.000Z',
  ],
] as const satisfies readonly (readonly [
  number,
  'NOTE' | 'INCIDENT' | 'ASSIGNMENT',
  'INFO' | 'WARNING' | 'DANGER',
  string,
  string,
  string | null,
  number | null,
  number | null,
  string,
])[];

const MANUAL_EVENTS: readonly ManualEventDefinition[] = MANUAL_EVENT_ROWS.map(
  ([
    vehicleNumber,
    kind,
    severity,
    title,
    description,
    location,
    latitude,
    longitude,
    recordedAt,
  ]) => ({
    vehicleNumber,
    kind,
    severity,
    title,
    description,
    location,
    latitude,
    longitude,
    recordedAt,
  }),
);

function vehicleFor(definition: { vehicleNumber: number }, vehicles: readonly SeedVehicle[]) {
  const vehicle = vehicles[definition.vehicleNumber - 1];
  if (!vehicle) {
    throw new Error(`Не найден автомобиль №${definition.vehicleNumber} для seed истории.`);
  }
  return vehicle;
}

export async function seedVehicleEventTimeline(
  database: EventTimelineSeedDatabase,
  companyId: string,
  adminUserId: string,
  vehicles: Array<SeedVehicle>,
): Promise<{ trips: number; events: number; fuelRecords: number; manualEvents: number }> {
  const fleetVehicles = [...vehicles].sort((first, second) =>
    first.internalNumber.localeCompare(second.internalNumber),
  );

  if (fleetVehicles.length < 23) {
    throw new Error('Для seed истории требуется не менее 23 автомобилей.');
  }

  for (const [index, trip] of TRIPS.entries()) {
    const vehicle = vehicleFor(trip, fleetVehicles);
    const data = {
      vehicleId: vehicle.id,
      startedAt: fixedDate(trip.startedAt),
      endedAt: fixedDate(trip.endedAt),
      distanceKm: trip.distanceKm,
      durationSeconds: trip.durationSeconds,
      averageSpeedKph: trip.averageSpeedKph,
      maximumSpeedKph: trip.maximumSpeedKph,
      fuelUsedLiters: trip.fuelUsedLiters,
    };
    const id = stableId('trip', vehicle.internalNumber, index + 1);
    await database.trip.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  for (const [index, event] of VEHICLE_EVENTS.entries()) {
    const vehicle = vehicleFor(event, fleetVehicles);
    const data = {
      vehicleId: vehicle.id,
      type: event.type,
      severity: event.severity,
      title: event.title,
      description: event.description,
      location: event.location,
      recordedAt: fixedDate(event.recordedAt),
    };
    const id = stableId('event', vehicle.internalNumber, index + 1);
    await database.vehicleEvent.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  for (const [index, fuelRecord] of FUEL_RECORDS.entries()) {
    const vehicle = vehicleFor(fuelRecord, fleetVehicles);
    const data = {
      vehicleId: vehicle.id,
      type: fuelRecord.type,
      volumeLiters: fuelRecord.volumeLiters,
      levelPercent: fuelRecord.levelPercent,
      consumption: fuelRecord.consumption,
      recordedAt: fixedDate(fuelRecord.recordedAt),
    };
    const id = stableId('fuel', vehicle.internalNumber, index + 1);
    await database.fuelRecord.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  for (const [index, event] of MANUAL_EVENTS.entries()) {
    const vehicle = vehicleFor(event, fleetVehicles);
    const data = {
      companyId,
      vehicleId: vehicle.id,
      authorId: adminUserId,
      kind: event.kind,
      severity: event.severity,
      title: event.title,
      description: event.description,
      location: event.location,
      latitude: event.latitude,
      longitude: event.longitude,
      recordedAt: fixedDate(event.recordedAt),
    };
    const id = stableId('manual', vehicle.internalNumber, index + 1);
    await database.manualVehicleEvent.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
  }

  return {
    trips: TRIPS.length,
    events: VEHICLE_EVENTS.length,
    fuelRecords: FUEL_RECORDS.length,
    manualEvents: MANUAL_EVENTS.length,
  };
}
