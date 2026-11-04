import type { DashboardAttentionItemDto, DashboardWorkItemDto } from './overview-types';
import { dayKey } from './workday-calendar';

const carouselKinds = new Set<DashboardWorkItemDto['kind']>([
  'HANDOVER',
  'DELIVERY',
  'RETURN',
  'RENTAL_END',
  'DEPOSIT_RETURN',
  'LOW_FUEL',
]);

export type WorkdayCarouselItem =
  | { id: string; type: 'operation'; operation: DashboardWorkItemDto }
  | { id: string; type: 'attention'; attention: DashboardAttentionItemDto };

function operationPriority(item: DashboardWorkItemDto) {
  if (item.overdue) return 0;
  if (item.tone === 'danger') return 1;
  if (item.kind === 'DEPOSIT_RETURN') return 3;
  if (item.kind === 'LOW_FUEL') return 4;
  return 2;
}

function isGpsSignalAttention(item: DashboardAttentionItemDto) {
  return item.id.startsWith('offline:') || /GPS-сигнала/iu.test(item.title);
}

export function buildWorkdayCarouselItems({
  items,
  attentionItems,
  selectedDay,
  today,
}: {
  items: DashboardWorkItemDto[];
  attentionItems: DashboardAttentionItemDto[];
  selectedDay: string;
  today: string;
}): WorkdayCarouselItem[] {
  const operations = items
    .filter(
      (item) =>
        carouselKinds.has(item.kind) && (item.overdue || dayKey(item.scheduledAt) === selectedDay),
    )
    .sort(
      (left, right) =>
        operationPriority(left) - operationPriority(right) ||
        new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime() ||
        left.id.localeCompare(right.id),
    );
  const operationIds = new Set(operations.map((item) => item.id));
  const result: WorkdayCarouselItem[] = operations.map((operation) => ({
    id: `operation:${operation.id}`,
    type: 'operation',
    operation,
  }));

  if (selectedDay === today) {
    result.push(
      ...attentionItems
        .filter(
          (item) =>
            !isGpsSignalAttention(item) &&
            !operationIds.has(item.id) &&
            !operationIds.has(item.id.replace(/^overdue:/u, '')),
        )
        .map((attention) => ({
          id: `attention:${attention.id}`,
          type: 'attention' as const,
          attention,
        })),
    );
  }

  return result;
}

export const workdayCarouselKinds = carouselKinds;
