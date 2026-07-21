import { describe, expect, it } from 'vitest';

import { parseMaintenanceInput } from './validation';

function maintenanceData(values: Record<string, string> = {}) {
  const formData = new FormData();

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }

  return formData;
}

describe('parseMaintenanceInput', () => {
  it('требует автомобиль, название, вид работы и плановую дату ТО', () => {
    const result = parseMaintenanceInput(new FormData());

    expect(result).toEqual({
      ok: false,
      state: expect.objectContaining({
        status: 'error',
        fieldErrors: expect.objectContaining({ vehicleId: expect.any(String) }),
      }),
    });
    expect(result).toEqual({
      ok: false,
      state: expect.objectContaining({
        fieldErrors: expect.objectContaining({
          title: expect.any(String),
          kind: expect.any(String),
          scheduledAt: expect.any(String),
        }),
      }),
    });
  });

  it('преобразует корректные данные ТО в доменный контракт', () => {
    const result = parseMaintenanceInput(
      maintenanceData({
        vehicleId: ' vehicle-1 ',
        title: ' Замена масла ',
        kind: 'OIL',
        scheduledAt: '2026-07-22T10:00',
        targetOdometerKm: '120000.5',
        provider: ' Сервис Плюс ',
        costRubles: '1250.5',
        notes: ' Заменить масло ',
      }),
    );

    expect(result).toEqual({
      ok: true,
      data: {
        vehicleId: 'vehicle-1',
        title: 'Замена масла',
        kind: 'OIL',
        scheduledAt: new Date('2026-07-22T07:00:00.000Z'),
        targetOdometerKm: 120000.5,
        provider: 'Сервис Плюс',
        costMinor: 125050,
        notes: 'Заменить масло',
      },
    });
  });

  it('ограничивает целевой пробег точностью Decimal(12,1)', () => {
    const result = parseMaintenanceInput(
      maintenanceData({
        vehicleId: 'vehicle-1',
        title: 'Замена масла',
        kind: 'OIL',
        scheduledAt: '2026-07-22T10:00',
        targetOdometerKm: '100000000000',
      }),
    );

    expect(result).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: {
          targetOdometerKm: 'Укажите пробег от 0 до 99 999 999 999,9 км с точностью до 0,1 км.',
        },
      },
    });
  });

  it('отклоняет неверные enum, дату, пробег и слишком длинный текст', () => {
    const result = parseMaintenanceInput(
      maintenanceData({
        vehicleId: 'vehicle-1',
        title: 'c'.repeat(501),
        kind: 'REPAIR',
        scheduledAt: '2026-02-30T10:00',
        targetOdometerKm: '-1',
        provider: 'a'.repeat(501),
        notes: 'b'.repeat(501),
      }),
    );

    expect(result).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: {
          kind: expect.any(String),
          title: expect.any(String),
          scheduledAt: expect.any(String),
          targetOdometerKm: expect.any(String),
          provider: expect.any(String),
          notes: expect.any(String),
        },
      },
    });
  });
});
