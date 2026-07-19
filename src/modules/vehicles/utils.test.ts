import { describe, expect, it } from 'vitest';

import { formatDailyPrice, formatOptionalMetric } from './utils';

describe('форматирование данных автомобиля', () => {
  it('форматирует стоимость в рублях и батах', () => {
    expect(formatDailyPrice(880000, 'RUB')).toBe('8 800 ₽/сутки');
    expect(formatDailyPrice(110000, 'THB')).toBe('1 100 ฿/сутки');
  });

  it('показывает честное пустое состояние для неизвестной метрики', () => {
    expect(formatOptionalMetric(null, 'км')).toBe('Нет данных');
    expect(formatOptionalMetric(156, 'км')).toBe('156 км');
  });
});
