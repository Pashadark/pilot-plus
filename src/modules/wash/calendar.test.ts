import { describe, expect, it } from 'vitest';

import type { WashRecordDto } from './server/queries';
import { washToCalendarEvent } from './calendar';

const record: WashRecordDto = {
  id: 'wash-1',
  vehicleId: 'vehicle-1',
  kind: 'COMPLEX',
  status: 'PLANNED',
  scheduledAt: '2026-07-22T07:00:00.000Z',
  startedAt: null,
  completedAt: null,
  provider: 'Чистый парк',
  costMinor: 150_000,
  notes: null,
  createdAt: '2026-07-20T09:00:00.000Z',
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: null,
  },
};

describe('washToCalendarEvent', () => {
  it('преобразует запланированную мойку в общий календарный контракт', () => {
    const event = washToCalendarEvent(record);

    expect(event.title).toBe('Комплексная');
    expect(event).toMatchObject({
      id: record.id,
      startsAt: record.scheduledAt,
      icon: 'droplet',
      statusLabel: 'Запланировано',
      tone: 'primary',
      vehicleLabel: 'PLT-001 · GWM WEY',
    });
  });

  it('использует безопасную подпись, когда данные автомобиля отсутствуют', () => {
    expect(
      washToCalendarEvent({
        ...record,
        vehicle: {
          ...record.vehicle,
          internalNumber: '',
          model: '   ',
          registrationNumber: null,
        },
      }).vehicleLabel,
    ).toBe('Автомобиль не указан');
  });

  it.each([
    ['PLANNED', 'Запланировано', 'primary'],
    ['IN_PROGRESS', 'В работе', 'warning'],
    ['COMPLETED', 'Завершено', 'success'],
    ['CANCELLED', 'Отменено', 'neutral'],
  ] as const)('преобразует статус %s в %s / %s', (status, statusLabel, tone) => {
    expect(washToCalendarEvent({ ...record, status })).toMatchObject({
      statusLabel,
      tone,
    });
  });
});
