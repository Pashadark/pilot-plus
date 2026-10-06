import type { RentalEvidenceStatus } from './types';

export function deriveEvidenceStatus(input: {
  hasVideo: boolean;
  hasDashboardPhoto: boolean;
}): RentalEvidenceStatus {
  if (input.hasVideo && input.hasDashboardPhoto) return 'COMPLETE';
  if (!input.hasVideo && input.hasDashboardPhoto) return 'VIDEO_MISSING';
  if (input.hasVideo && !input.hasDashboardPhoto) return 'DASHBOARD_PHOTO_MISSING';
  return 'MISSING';
}

export function deriveReturnEvidenceStatus(input: {
  hasVideo: boolean;
  hasDashboardPhoto: boolean;
}): RentalEvidenceStatus {
  if (input.hasDashboardPhoto) return 'COMPLETE';
  if (input.hasVideo) return 'DASHBOARD_PHOTO_MISSING';
  return 'MISSING';
}
