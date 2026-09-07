import type { DashboardPeriod } from './date-window';

export type DashboardWorkItemKind =
  | 'HANDOVER'
  | 'DELIVERY'
  | 'RETURN'
  | 'RENTAL_END'
  | 'EXTENSION'
  | 'DEPOSIT_RETURN'
  | 'MAINTENANCE'
  | 'WASH'
  | 'LEAD'
  | 'MANUAL_TASK';

export type DashboardWorkItemDto = {
  id: string;
  kind: DashboardWorkItemKind;
  scheduledAt: string;
  title: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  href: string;
  vehicleLabel: string;
  clientLabel: string | null;
  phone: string | null;
  contractNumber: string | null;
  address: string | null;
  amountMinor: string | null;
  overdue: boolean;
  unscheduled?: boolean;
  completable?: boolean;
};

export type DashboardKpiDto = {
  earnedMinor: string;
  earnedIsEstimated: true;
  lifetimeEarnedMinor: string;
  lifetimeDepositsMinor: string;
  heldDepositsMinor: string;
  freeVehicles: number;
  occupiedVehicles: number;
  serviceVehicles: number;
  offlineVehicles: number;
};

export type DashboardAttentionItemDto = {
  id: string;
  tone: 'warning' | 'danger';
  title: string;
  description: string;
  href: string;
};

export type DashboardOverviewDto = {
  period: { key: DashboardPeriod | 'custom'; label: string; from: string; toExclusive: string };
  kpis: DashboardKpiDto;
  workItems: DashboardWorkItemDto[];
  attentionItems: DashboardAttentionItemDto[];
};
