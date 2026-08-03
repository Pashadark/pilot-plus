import type { OperationsCalendarEvent } from '@/shared/components/operations-calendar';

import type { MaintenanceRecordDto } from './server/queries';
import type { MaintenanceStatus } from './types';

const maintenanceCalendarStatus: Record<
  MaintenanceStatus,
  Pick<OperationsCalendarEvent, 'statusLabel' | 'tone'>
> = {
  PLANNED: { statusLabel: 'Запланировано', tone: 'primary' },
  IN_PROGRESS: { statusLabel: 'В работе', tone: 'warning' },
  COMPLETED: { statusLabel: 'Завершено', tone: 'success' },
  OVERDUE: { statusLabel: 'Просрочено', tone: 'danger' },
  CANCELLED: { statusLabel: 'Отменено', tone: 'neutral' },
};

export function maintenanceToCalendarEvent(
  record: MaintenanceRecordDto,
): OperationsCalendarEvent | null {
  if (!record.scheduledAt) return null;

  const status = maintenanceCalendarStatus[record.status];
  const vehicleLabel = [
    record.vehicle.internalNumber,
    record.vehicle.model,
    record.vehicle.registrationNumber,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' · ');

  return {
    id: record.id,
    startsAt: record.scheduledAt,
    title: record.title,
    vehicleLabel: vehicleLabel || 'Автомобиль не указан',
    statusLabel: status.statusLabel,
    tone: status.tone,
    icon: 'tool',
  };
}
