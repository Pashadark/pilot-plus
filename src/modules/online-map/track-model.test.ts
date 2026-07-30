import { describe, expect, it } from 'vitest';

import {
  buildTrackPeriodViewModel,
  buildTrackViewModel,
  getPlaybackPosition,
  getVehicleTrack,
  getVehicleTrackDates,
  getVehicleTracks,
} from './track-model';
import { vehicleTrackFixtures } from './track-fixtures';
import type { VehicleTrack } from './track-types';

const track: VehicleTrack = {
  vehicleId: 'vehicle-1',
  date: '2026-07-29',
  points: [
    { id: 'p0', coordinates: [92.8, 56], timestamp: '08:00', speedKph: 0, address: 'Старт' },
    { id: 'p1', coordinates: [92.81, 56.01], timestamp: '08:10', speedKph: 39, address: 'Улица 1' },
    { id: 'p2', coordinates: [92.82, 56.02], timestamp: '08:20', speedKph: 40, address: 'Улица 2' },
    { id: 'p3', coordinates: [92.83, 56.03], timestamp: '08:30', speedKph: 70, address: 'Финиш' },
  ],
  events: [
    { id: 'event-1', type: 'stop', pointId: 'p2', title: 'Остановка', description: '10 минут' },
  ],
};

describe('buildTrackViewModel', () => {
  it('окрашивает сегменты по порогам скорости и задаёт прозрачность 0.72', () => {
    const model = buildTrackViewModel(track);

    expect(model.segments.map(({ color, opacity }) => [color, opacity])).toEqual([
      ['green', 0.72],
      ['yellow', 0.72],
      ['red', 0.72],
    ]);
  });

  it('обрабатывает границы порогов скорости 39, 40, 69 и 70 км/ч', () => {
    const model = buildTrackViewModel({
      ...track,
      points: [
        track.points[0],
        { ...track.points[1], speedKph: 39 },
        { ...track.points[2], speedKph: 40 },
        { ...track.points[3], id: 'p3a', speedKph: 69 },
        { ...track.points[3], id: 'p4', speedKph: 70 },
      ],
      events: [],
    });

    expect(model.segments.map((segment) => segment.color)).toEqual([
      'green',
      'yellow',
      'yellow',
      'red',
    ]);
  });

  it('помещает событие точно в координаты связанной точки', () => {
    expect(buildTrackViewModel(track).events[0].coordinates).toEqual([92.82, 56.02]);
  });

  it('группирует события в одинаковых координатах', () => {
    const model = buildTrackViewModel({
      ...track,
      events: [
        ...track.events,
        {
          id: 'event-2',
          type: 'refuel',
          pointId: 'p2',
          title: 'Заправка',
          description: 'АИ-95',
        },
      ],
    });

    expect(model.eventGroups).toHaveLength(1);
    expect(model.eventGroups[0]).toMatchObject({ id: 'event-1', count: 2 });
  });

  it('возвращает старт, финиш, показатели поездки и позицию ползунка', () => {
    const model = buildTrackViewModel(track);

    expect(model.start.coordinates).toEqual([92.8, 56]);
    expect(model.finish.coordinates).toEqual([92.83, 56.03]);
    expect(model.durationMinutes).toBe(30);
    expect(model.maxSpeedKph).toBe(70);
    expect(model.stopsCount).toBe(1);
    expect(model.distanceKm).toBeGreaterThan(0);
    expect(getPlaybackPosition(track, 50).coordinates).toEqual([92.82, 56.02]);
  });

  it('ограничивает ползунок началом и концом маршрута', () => {
    expect(getPlaybackPosition(track, -10).id).toBe('p0');
    expect(getPlaybackPosition(track, 120).id).toBe('p3');
  });

  it('отклоняет маршрут короче двух точек', () => {
    expect(() => buildTrackViewModel({ ...track, points: [track.points[0]] })).toThrow(
      'Маршрут должен содержать минимум две точки',
    );
  });

  it('отклоняет событие без точки маршрута', () => {
    expect(() =>
      buildTrackViewModel({
        ...track,
        events: [
          {
            id: 'unknown-point',
            type: 'stop',
            pointId: 'missing',
            title: 'Остановка',
            description: 'Нет координат',
          },
        ],
      }),
    ).toThrow('Событие не привязано к точке маршрута');
  });
});

describe('buildTrackPeriodViewModel', () => {
  it('строит семидневный период из отдельных поездок и агрегирует сводку', () => {
    const tracks = getVehicleTracks('lada-vesta-a123mr77', [
      '2026-07-29',
      '2026-07-28',
      '2026-07-27',
    ]);
    const model = buildTrackPeriodViewModel(tracks, 'seven-days');

    expect(model.period).toBe('seven-days');
    expect(model.trips.map((trip) => trip.date)).toEqual([
      '2026-07-29',
      '2026-07-28',
      '2026-07-27',
    ]);
    expect(model.activeTrip.date).toBe('2026-07-29');
    expect(new Set(model.segments.map((segment) => segment.tripId)).size).toBe(3);
    expect(model.distanceKm).toBeCloseTo(
      model.trips.reduce((total, trip) => total + trip.distanceKm, 0),
    );
    expect(model.durationMinutes).toBe(
      model.trips.reduce((total, trip) => total + trip.durationMinutes, 0),
    );
    expect(model.stopsCount).toBe(model.trips.reduce((total, trip) => total + trip.stopsCount, 0));
  });

  it('считает стоянки только по stop-событиям, а не по всем событиям', () => {
    const model = buildTrackPeriodViewModel(
      [
        {
          ...track,
          events: [
            ...track.events,
            {
              id: 'event-2',
              type: 'connection-loss',
              pointId: 'p2',
              title: 'Потеря связи',
              description: '2 минуты',
            },
          ],
        },
      ],
      'day',
    );

    expect(model.events).toHaveLength(2);
    expect(model.eventGroups[0].count).toBe(2);
    expect(model.stopsCount).toBe(1);
  });
});

describe('getVehicleTrackDates', () => {
  it('возвращает даты автомобиля от новой к старой', () => {
    expect(getVehicleTrackDates('haval-jolion-v456kh178')).toEqual([
      '2026-07-29',
      '2026-07-28',
      '2026-07-27',
    ]);
  });

  it('возвращает маршрут только для указанного автомобиля и даты', () => {
    expect(getVehicleTrack('haval-jolion-v456kh178', '2026-07-28')).toMatchObject({
      vehicleId: 'haval-jolion-v456kh178',
      date: '2026-07-28',
    });
    expect(getVehicleTrack('haval-jolion-v456kh178', '2026-07-01')).toBeNull();
  });
});

describe('vehicleTrackFixtures', () => {
  it('распределяет потерю связи и геозоны по 15 поездкам', () => {
    expect(vehicleTrackFixtures).toHaveLength(15);
    const types = vehicleTrackFixtures.flatMap((fixture) =>
      fixture.events.map((event) => event.type),
    );

    expect(types.filter((type) => type === 'connection-loss')).toHaveLength(5);
    expect(types.filter((type) => type === 'geofence-enter')).toHaveLength(5);
    expect(types.filter((type) => type === 'geofence-exit')).toHaveLength(5);
  });

  it('содержит сгруппированные события в одной точке', () => {
    expect(
      vehicleTrackFixtures.some((fixture) => {
        const pointIds = fixture.events.map((event) => event.pointId);
        return new Set(pointIds).size < pointIds.length;
      }),
    ).toBe(true);
  });
});
