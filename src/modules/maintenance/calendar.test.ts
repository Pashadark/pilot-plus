import { describe, expect, it } from 'vitest';

import type { MaintenanceRecordDto } from './server/queries';
import { maintenanceToCalendarEvent } from './calendar';

const record: MaintenanceRecordDto = {
  id: 'maintenance-1',
  vehicleId: 'vehicle-1',
  title: 'Замена масла',
  kind: 'OIL',
  status: 'OVERDUE',
  scheduledAt: '2026-07-22T06:30:00.000Z',
  completedAt: null,
  odometerKm: 12_000,
  currentOdometerKm: 12_500,
  targetOdometerKm: 15_000,
  provider: 'Сервис Pilot+',
  costMinor: 420_000,
  notes: null,
  createdAt: '2026-07-20T09:00:00.000Z',
  vehicle: {
    id: 'vehicle-1',
    internalNumber: 'PLT-001',
    model: 'GWM WEY',
    registrationNumber: null,
  },
};

describe('maintenanceToCalendarEvent', () => {
  it('преобразует просроченное ТО в общий календарный контракт', () => {
    expect(maintenanceToCalendarEvent(record)).toMatchObject({
      id: record.id,
      startsAt: record.scheduledAt,
      title: record.title,
      icon: 'tool',
      statusLabel: 'Просрочено',
      tone: 'danger',
      vehicleLabel: 'PLT-001 · GWM WEY',
    });
  });

  it('не создаёт календарное событие без плановой даты', () => {
    expect(maintenanceToCalendarEvent({ ...record, scheduledAt: null })).toBeNull();
  });

  it.each([
    ['PLANNED', 'Запланировано', 'primary'],
    ['IN_PROGRESS', 'В работе', 'warning'],
    ['COMPLETED', 'Завершено', 'success'],
    ['OVERDUE', 'Просрочено', 'danger'],
    ['CANCELLED', 'Отменено', 'neutral'],
  ] as const)('преобразует статус %s в %s / %s', (status, statusLabel, tone) => {
    expect(maintenanceToCalendarEvent({ ...record, status })).toMatchObject({
      statusLabel,
      tone,
    });
  });
});
