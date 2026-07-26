import type { OperationsCalendarEvent } from '@/shared/components/operations-calendar';

import type { WashRecordDto } from './server/queries';
import type { WashKind, WashStatus } from './types';

const washCalendarStatus: Record<
  WashStatus,
  Pick<OperationsCalendarEvent, 'statusLabel' | 'tone'>
> = {
  PLANNED: { statusLabel: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { statusLabel: 'В работе', tone: 'warning' },
  COMPLETED: { statusLabel: 'Завершено', tone: 'success' },
  CANCELLED: { statusLabel: 'Отменено', tone: 'neutral' },
};

const washCalendarTitles: Record<WashKind, string> = {
  BODY: 'Кузов',
  COMPLEX: 'Комплексная',
  INTERIOR: 'Салон',
  MATS: 'Коврики',
  ENGINE: 'Двигатель',
  OTHER: 'Другое',
};

export function washToCalendarEvent(record: WashRecordDto): OperationsCalendarEvent {
  const status = washCalendarStatus[record.status];

  return {
    id: record.id,
    startsAt: record.scheduledAt,
    title: washCalendarTitles[record.kind],
    vehicleLabel: [
      record.vehicle.internalNumber,
      record.vehicle.model,
      record.vehicle.registrationNumber,
    ]
      .filter(Boolean)
      .join(' · '),
    statusLabel: status.statusLabel,
    tone: status.tone,
    icon: 'droplet',
  };
}
