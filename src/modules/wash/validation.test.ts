import { describe, expect, it } from 'vitest';

import { parseWashInput } from './validation';

function washData(values: Record<string, string> = {}) {
  const formData = new FormData();

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value);
  }

  return formData;
}

describe('parseWashInput', () => {
  it('не принимает отрицательную стоимость мойки', () => {
    const form = new FormData();
    form.set('vehicleId', 'vehicle-1');
    form.set('kind', 'COMPLEX');
    form.set('scheduledAt', '2026-07-22T10:00');
    form.set('costRubles', '-1');

    expect(parseWashInput(form)).toEqual({
      ok: false,
      state: expect.objectContaining({ fieldErrors: { costRubles: expect.any(String) } }),
    });
  });

  it('преобразует стоимость в копейки и нормализует текст', () => {
    expect(
      parseWashInput(
        washData({
          vehicleId: ' vehicle-1 ',
          kind: 'COMPLEX',
          scheduledAt: '2026-07-22T10:00',
          provider: ' Чистый город ',
          costRubles: '2500.49',
          notes: ' Комплексная мойка ',
        }),
      ),
    ).toEqual({
      ok: true,
      data: {
        vehicleId: 'vehicle-1',
        kind: 'COMPLEX',
        scheduledAt: new Date('2026-07-22T07:00:00.000Z'),
        provider: 'Чистый город',
        costMinor: 250049,
        notes: 'Комплексная мойка',
      },
    });
  });

  it('отклоняет отсутствующие обязательные поля, неверный вид и слишком длинную заметку', () => {
    const result = parseWashInput(
      washData({ kind: 'WINDOWS', scheduledAt: 'not-a-date', notes: 'a'.repeat(501) }),
    );

    expect(result).toEqual({
      ok: false,
      state: {
        status: 'error',
        fieldErrors: {
          vehicleId: expect.any(String),
          kind: expect.any(String),
          scheduledAt: expect.any(String),
          notes: expect.any(String),
        },
      },
    });
  });
});
