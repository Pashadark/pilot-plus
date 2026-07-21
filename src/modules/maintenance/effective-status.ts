import type { MaintenanceStatus } from './types';
import { getPilotBusinessDateParts } from '@/shared/business-time';

type SummaryRecord = {
  status: MaintenanceStatus;
  scheduledAt: string | null;
  completedAt: string | null;
};

export function getEffectiveMaintenanceStatus(
  storedStatus: MaintenanceStatus,
  scheduledAt: string | Date | null,
  referenceTime: Date,
): MaintenanceStatus {
  if (
    storedStatus === 'PLANNED' &&
    scheduledAt &&
    new Date(scheduledAt).getTime() < referenceTime.getTime()
  ) {
    return 'OVERDUE';
  }

  return storedStatus;
}

export function calculateMaintenanceSummary(
  records: readonly SummaryRecord[],
  referenceTime: Date,
) {
  const sevenDaysFromNow = referenceTime.getTime() + 7 * 24 * 60 * 60 * 1000;
  const referenceMonth = getPilotBusinessDateParts(referenceTime);

  return records.reduce(
    (summary, record) => {
      if (record.status === 'PLANNED') {
        summary.planned += 1;
        const scheduledAt = record.scheduledAt ? new Date(record.scheduledAt).getTime() : null;
        if (
          scheduledAt !== null &&
          scheduledAt >= referenceTime.getTime() &&
          scheduledAt <= sevenDaysFromNow
        ) {
          summary.dueSoon += 1;
        }
      }

      if (record.status === 'OVERDUE') summary.overdue += 1;

      if (record.status === 'COMPLETED' && record.completedAt) {
        const completedMonth = getPilotBusinessDateParts(new Date(record.completedAt));
        if (
          completedMonth.year === referenceMonth.year &&
          completedMonth.month === referenceMonth.month
        ) {
          summary.completedThisMonth += 1;
        }
      }

      return summary;
    },
    { planned: 0, dueSoon: 0, overdue: 0, completedThisMonth: 0 },
  );
}
