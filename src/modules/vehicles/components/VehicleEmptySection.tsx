import type { VehicleTab } from './vehicle-tabs';
import { getVehicleEmptyState } from './vehicle-tabs';
import { EmptyState } from '@/shared/ui';

export function VehicleEmptySection({ tab }: { tab: Exclude<VehicleTab, 'overview'> }) {
  return <EmptyState {...getVehicleEmptyState(tab)} />;
}
