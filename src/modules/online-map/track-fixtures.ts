import type { VehicleTrack, VehicleTrackPoint } from './track-types';

const routeAddresses = [
  'Красноярск, ул. Карла Маркса',
  'Красноярск, ул. Дубровинского',
  'Красноярск, проспект Мира',
  'Красноярск, ул. Ленина',
  'Красноярск, ул. Вейнбаума',
  'Красноярск, ул. Белинского',
  'Красноярск, ул. Партизана Железняка',
  'Красноярск, ул. Молокова',
] as const;

function createPoint(
  id: string,
  longitude: number,
  latitude: number,
  timestamp: string,
  speedKph: number,
  address: string,
): VehicleTrackPoint {
  return {
    id,
    coordinates: [longitude, latitude],
    timestamp,
    speedKph,
    address,
  };
}

function createTrack(
  vehicleId: string,
  date: string,
  longitude: number,
  latitude: number,
  routeIndex: number,
): VehicleTrack {
  const pointId = (index: number) => `${vehicleId}-${date}-p${index}`;
  const points = [
    createPoint(pointId(0), longitude, latitude, '08:00', 0, routeAddresses[0]),
    createPoint(pointId(1), longitude + 0.003, latitude + 0.001, '08:08', 32, routeAddresses[1]),
    createPoint(pointId(2), longitude + 0.006, latitude + 0.002, '08:16', 48, routeAddresses[2]),
    createPoint(pointId(3), longitude + 0.009, latitude + 0.003, '08:24', 74, routeAddresses[3]),
    createPoint(pointId(4), longitude + 0.012, latitude + 0.004, '08:32', 44, routeAddresses[4]),
    createPoint(pointId(5), longitude + 0.015, latitude + 0.005, '08:40', 35, routeAddresses[5]),
    createPoint(pointId(6), longitude + 0.018, latitude + 0.006, '08:48', 72, routeAddresses[6]),
    createPoint(pointId(7), longitude + 0.021, latitude + 0.007, '08:56', 0, routeAddresses[7]),
  ] as const;

  const distributedEvent =
    routeIndex % 3 === 0
      ? {
          id: `${vehicleId}-${date}-connection-loss`,
          type: 'connection-loss' as const,
          pointId: pointId(4),
          title: 'Потеря связи',
          description: 'Сигнал восстановлен через 2 минуты',
        }
      : routeIndex % 3 === 1
        ? {
            id: `${vehicleId}-${date}-geofence-enter`,
            type: 'geofence-enter' as const,
            pointId: pointId(3),
            title: 'Въезд в геозону',
            description: 'Склад на улице Ленина',
          }
        : {
            id: `${vehicleId}-${date}-geofence-exit`,
            type: 'geofence-exit' as const,
            pointId: pointId(5),
            title: 'Выезд из геозоны',
            description: 'Покинул зону доставки',
          };

  return {
    vehicleId,
    date,
    points,
    events: [
      {
        id: `${vehicleId}-${date}-stop`,
        type: 'stop',
        pointId: pointId(2),
        title: 'Остановка',
        description: '8 минут',
      },
      {
        id: `${vehicleId}-${date}-refuel`,
        type: 'refuel',
        pointId: pointId(4),
        title: 'Заправка',
        description: 'АИ-95, 25 литров',
      },
      {
        id: `${vehicleId}-${date}-speeding`,
        type: 'speeding',
        pointId: pointId(6),
        title: 'Превышение скорости',
        description: '72 км/ч',
      },
      distributedEvent,
    ],
  };
}

const fixtureDefinitions = [
  ['lada-vesta-a123mr77', 92.851, 56.009],
  ['haval-jolion-v456kh178', 92.869, 56.016],
  ['geely-atlas-e789no77', 92.846, 56.027],
  ['kia-k5-k111mr199', 92.812, 55.983],
  ['changan-uni-k-m333ah750', 92.9, 56.001],
] as const;

const fixtureDates = ['2026-07-29', '2026-07-28', '2026-07-27'] as const;

// Демонстрационные маршруты изолированы от будущего потока телеметрии.
export const vehicleTrackFixtures: readonly VehicleTrack[] = fixtureDefinitions.flatMap(
  ([vehicleId, longitude, latitude], vehicleIndex) =>
    fixtureDates.map((date, index) =>
      createTrack(
        vehicleId,
        date,
        longitude + index * 0.001,
        latitude + index * 0.001,
        vehicleIndex * fixtureDates.length + index,
      ),
    ),
);
