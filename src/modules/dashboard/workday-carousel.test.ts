import { describe, expect, it } from 'vitest';

import type { DashboardAttentionItemDto, DashboardWorkItemDto } from './overview-types';
import { buildWorkdayCarouselItems } from './workday-carousel';

function operation(overrides: Partial<DashboardWorkItemDto> = {}): DashboardWorkItemDto {
  return {
    id: 'return:rental-1',
    kind: 'RETURN',
    scheduledAt: '2026-10-11T14:00:00.000Z',
    title: 'Принять возврат автомобиля',
    tone: 'warning',
    href: '/rentals/rental-1',
    vehicleLabel: 'Kia K5 · Р044ЕА323',
    clientLabel: 'Горбунов Артём Денисович',
    phone: null,
    contractNumber: 'ME-2026-0090-GA',
    address: null,
    amountMinor: null,
    overdue: false,
    ...overrides,
  };
}

function attention(overrides: Partial<DashboardAttentionItemDto> = {}): DashboardAttentionItemDto {
  return {
    id: 'offline:vehicle-1',
    tone: 'warning',
    title: 'Нет актуального GPS-сигнала',
    description: 'Kia K5 · Р044ЕА323',
    href: '/vehicles/vehicle-1',
    ...overrides,
  };
}

describe('buildWorkdayCarouselItems', () => {
  it('orders urgent items before timed operations and deposit reminders', () => {
    const items = buildWorkdayCarouselItems({
      selectedDay: '2026-10-11',
      today: '2026-10-11',
      items: [
        operation({ id: 'deposit', kind: 'DEPOSIT_RETURN', scheduledAt: '2026-10-11T18:00:00Z' }),
        operation({ id: 'return', scheduledAt: '2026-10-11T12:00:00Z' }),
        operation({
          id: 'overdue',
          overdue: true,
          tone: 'danger',
          scheduledAt: '2026-10-10T12:00:00Z',
        }),
      ],
      attentionItems: [attention()],
    });

    expect(items.map((item) => item.id)).toEqual([
      'operation:overdue',
      'operation:return',
      'operation:deposit',
    ]);
  });

  it('keeps GPS-loss warnings out of the event carousel', () => {
    const items = buildWorkdayCarouselItems({
      selectedDay: '2026-10-11',
      today: '2026-10-11',
      items: [],
      attentionItems: [
        attention(),
        attention({
          id: 'server:billing',
          title: 'Нужно пополнить баланс сервера',
          href: '/system',
        }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(['attention:server:billing']);
  });

  it('does not repeat an operation through its attention mirror', () => {
    const items = buildWorkdayCarouselItems({
      selectedDay: '2026-10-11',
      today: '2026-10-11',
      items: [operation({ id: 'low-fuel:vehicle-1', kind: 'LOW_FUEL' })],
      attentionItems: [
        attention({
          id: 'low-fuel:vehicle-1',
          title: 'Нужна заправка',
          href: '/vehicles/vehicle-1',
        }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual(['operation:low-fuel:vehicle-1']);
  });

  it('does not mix current live warnings into another selected day', () => {
    const items = buildWorkdayCarouselItems({
      selectedDay: '2026-10-12',
      today: '2026-10-11',
      items: [operation({ id: 'future', scheduledAt: '2026-10-12T12:00:00Z' })],
      attentionItems: [attention()],
    });

    expect(items.map((item) => item.id)).toEqual(['operation:future']);
  });
});
