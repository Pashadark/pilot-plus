import { describe, expect, it } from 'vitest';

import { getViolationIcon } from './violation-icon';

describe('getViolationIcon', () => {
  it('chooses a dedicated PNG sprite position for each known fine category', () => {
    expect(getViolationIcon('Превышение скорости движения ТС от 20 до 40 км/ч')).toBe('speed');
    expect(getViolationIcon('Нар. правил пользования ремнями безопасности или мотошлемами')).toBe(
      'seatbelt',
    );
    expect(getViolationIcon('Движение или остановка на полосе для маршрутных ТС')).toBe('bus-lane');
    expect(getViolationIcon('Неуплата за размещение транспортного средства на платной городской парковке г.Москвы')).toBe(
      'parking',
    );
    expect(getViolationIcon('Проезд на запрещ. сигнал светофора')).toBe('traffic-light');
    expect(getViolationIcon('Несоблюдение требований знаков или разметки')).toBe('road-sign');
    expect(getViolationIcon('Оплата за проезды по участкам Московского скоростного диаметра')).toBe(
      'toll',
    );
  });

  it('keeps an unknown provider wording readable with the neutral PNG icon', () => {
    expect(getViolationIcon('ч.1 ст.10.13 КоАП г.Москвы')).toBe('general');
    expect(getViolationIcon(null)).toBe('general');
  });
});
