import { describe, expect, it } from 'vitest';

import { deriveVehicleGpsStatus } from './gps-status';

const now = new Date('2026-08-22T12:00:00.000Z');

describe('deriveVehicleGpsStatus', () => {
  it('keeps a coordinate fresh at exactly fifteen minutes', () => {
    const status = deriveVehicleGpsStatus(
      {
        recordedAt: new Date(now.getTime() - 15 * 60 * 1000),
        speedKph: 0,
        address: 'Москва, Зеленый проспект 22',
        hasCoordinates: true,
      },
      now,
    );

    expect(status).toEqual({
      key: 'IN_PARK',
      label: 'В парке',
      tone: 'success',
      isConnected: true,
    });
  });

  it('marks a coordinate stale one millisecond after fifteen minutes', () => {
    const status = deriveVehicleGpsStatus(
      {
        recordedAt: new Date(now.getTime() - 15 * 60 * 1000 - 1),
        speedKph: 32,
        address: 'Москва, Зеленый проспект 22',
        hasCoordinates: true,
      },
      now,
    );

    expect(status).toEqual({
      key: 'STALE',
      label: 'Давно не обновлялся',
      tone: 'danger',
      isConnected: false,
    });
  });

  it('reports no data when coordinates are missing', () => {
    const status = deriveVehicleGpsStatus(
      {
        recordedAt: now,
        speedKph: 0,
        address: null,
        hasCoordinates: false,
      },
      now,
    );

    expect(status).toEqual({
      key: 'NO_DATA',
      label: 'Нет связи',
      tone: 'danger',
      isConnected: false,
    });
  });

  it('reports no data when the signal time is missing', () => {
    expect(
      deriveVehicleGpsStatus(
        { recordedAt: null, speedKph: 0, address: null, hasCoordinates: true },
        now,
      ),
    ).toEqual({
      key: 'NO_DATA',
      label: 'Нет связи',
      tone: 'danger',
      isConnected: false,
    });
  });

  it('reports a fresh moving vehicle with the blue semantic tone', () => {
    expect(
      deriveVehicleGpsStatus(
        {
          recordedAt: now,
          speedKph: 42,
          address: 'Москва, другой адрес',
          hasCoordinates: true,
        },
        now,
      ),
    ).toEqual({
      key: 'MOVING',
      label: 'В движении',
      tone: 'primary',
      isConnected: true,
    });
  });

  it('recognizes both spellings of the park address for a fresh stopped vehicle', () => {
    for (const address of ['г. Москва, Зелёный проспект, д. 22', 'Москва, Зеленый проспект 22']) {
      expect(
        deriveVehicleGpsStatus({ recordedAt: now, speedKph: 0, address, hasCoordinates: true }, now)
          .key,
      ).toBe('IN_PARK');
    }
  });

  it('reports a fresh stopped vehicle outside the park as idle', () => {
    expect(
      deriveVehicleGpsStatus(
        {
          recordedAt: now,
          speedKph: 0,
          address: 'Москва, другой адрес',
          hasCoordinates: true,
        },
        now,
      ).key,
    ).toBe('IDLE');
  });
});
