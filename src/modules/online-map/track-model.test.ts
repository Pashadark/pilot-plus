import { describe, expect, it } from 'vitest';

import {
  buildTrackActivitySections,
  buildTrackPeriodViewModel,
  buildTrackViewModel,
  getSpeedColor,
  getPlaybackPosition,
} from './track-model';
import { getVehicleTrack, getVehicleTrackDates, getVehicleTracks } from './track-fixture-model';
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
  it('показывает точный штраф по его координатам без выдуманной GPS-точки', () => {
    const model = buildTrackViewModel({
      ...track,
      events: [
        {
          id: 'fine-1',
          type: 'fine',
          pointId: 'fine-1',
          title: 'Штраф',
          description: 'Превышение скорости',
          coordinates: [37.65, 55.75],
          timestamp: '10:05',
          speedKph: 0,
          address: 'Москва',
        },
      ],
    });

    expect(model.events[0]).toEqual(
      expect.objectContaining({ coordinates: [37.65, 55.75], timestamp: '10:05' }),
    );
  });

  it('окрашивает сегменты по порогам скорости и задаёт прозрачность 0.72', () => {
    const model = buildTrackViewModel(track);

    expect(model.segments.map(({ color, opacity }) => [color, opacity])).toEqual([
      ['green', 0.72],
      ['yellow', 0.72],
      ['orange', 0.72],
    ]);
  });

  it('обрабатывает границы четырёх диапазонов скорости', () => {
    const model = buildTrackViewModel({
      ...track,
      points: [
        track.points[0],
        { ...track.points[1], speedKph: 39 },
        { ...track.points[2], speedKph: 40 },
        { ...track.points[3], id: 'p3a', speedKph: 69 },
        { ...track.points[3], id: 'p4', speedKph: 70 },
        { ...track.points[3], id: 'p5', speedKph: 99 },
        { ...track.points[3], id: 'p6', speedKph: 100 },
      ],
      events: [],
    });

    expect(model.segments.map((segment) => segment.color)).toEqual([
      'green',
      'yellow',
      'yellow',
      'orange',
      'orange',
      'red',
    ]);
    expect([0, 39, 40, 69, 70, 99, 100].map(getSpeedColor)).toEqual([
      'green',
      'green',
      'yellow',
      'yellow',
      'orange',
      'orange',
      'red',
    ]);
  });

  it('does not connect or count distance across a telemetry gap over 20 minutes', () => {
    const model = buildTrackViewModel({
      ...track,
      points: [
        track.points[0],
        { ...track.points[1], timestamp: '08:10' },
        { ...track.points[2], timestamp: '08:31' },
      ],
      events: [],
    });

    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]).toMatchObject({ from: { id: 'p0' }, to: { id: 'p1' } });
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

describe('buildTrackActivitySections', () => {
  it('объединяет непрерывную стоянку и разделяет движение и превышение', () => {
    const model = buildTrackViewModel({
      vehicleId: 'vehicle-activity',
      date: '2026-10-04',
      points: [
        { id: 'a0', coordinates: [37.6, 55.7], timestamp: '00:00', speedKph: 0, address: 'Стоянка' },
        { id: 'a1', coordinates: [37.6, 55.7], timestamp: '00:05', speedKph: 0, address: 'Стоянка' },
        { id: 'a2', coordinates: [37.6, 55.7], timestamp: '00:10', speedKph: 0, address: 'Стоянка' },
        { id: 'a3', coordinates: [37.61, 55.71], timestamp: '00:15', speedKph: 35, address: 'Москва' },
        { id: 'a4', coordinates: [37.62, 55.72], timestamp: '00:20', speedKph: 45, address: 'Москва' },
        { id: 'a5', coordinates: [37.63, 55.73], timestamp: '00:25', speedKph: 151, address: 'МКАД' },
        { id: 'a6', coordinates: [37.64, 55.74], timestamp: '00:30', speedKph: 42, address: 'Москва' },
      ],
      events: [],
    });

    const sections = buildTrackActivitySections(model.segments);

    expect(sections.map((section) => section.kind)).toEqual([
      'stopped',
      'moving',
      'speeding',
      'moving',
    ]);
    expect(sections[0]).toMatchObject({
      from: { timestamp: '00:00' },
      to: { timestamp: '00:10' },
      durationMinutes: 10,
      segmentIds: ['a0-a1', 'a1-a2'],
    });
    expect(sections[1]).toMatchObject({ durationMinutes: 10, maxSpeedKph: 45 });
    expect(sections[2]).toMatchObject({ maxSpeedKph: 151, segmentIds: ['a4-a5'] });
  });

  it('не склеивает одинаковые состояния через разрыв телеметрии', () => {
    const model = buildTrackViewModel({
      vehicleId: 'vehicle-gap',
      date: '2026-10-04',
      points: [
        { id: 'g0', coordinates: [37.6, 55.7], timestamp: '00:00', speedKph: 0, address: 'Москва' },
        { id: 'g1', coordinates: [37.6, 55.7], timestamp: '00:05', speedKph: 0, address: 'Москва' },
        { id: 'g2', coordinates: [37.6, 55.7], timestamp: '00:30', speedKph: 0, address: 'Москва' },
        { id: 'g3', coordinates: [37.6, 55.7], timestamp: '00:35', speedKph: 0, address: 'Москва' },
      ],
      events: [],
    });

    expect(buildTrackActivitySections(model.segments)).toHaveLength(2);
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
