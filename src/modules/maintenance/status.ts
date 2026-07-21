import type { MaintenanceStatus } from './types';

const allowedTransitions: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  OVERDUE: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionMaintenance(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return allowedTransitions[from].includes(to);
}
