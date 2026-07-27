import { getDeviceStatusMeta } from '../status';
import type { DeviceStatus } from '../types';
import { Badge } from '@/shared/ui';

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const meta = getDeviceStatusMeta(status);
  const Icon = meta.icon;

  return (
    <Badge tone={meta.tone} className="items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden="true" className="size-3.5" />
      {meta.label}
    </Badge>
  );
}
