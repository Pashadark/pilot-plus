import type { WashStatus } from './types';

const allowedTransitions: Record<WashStatus, readonly WashStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionWash(from: WashStatus, to: WashStatus): boolean {
  return allowedTransitions[from].includes(to);
}
