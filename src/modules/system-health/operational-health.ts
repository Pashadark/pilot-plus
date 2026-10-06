export type OperationalHealthState = 'healthy' | 'degraded' | 'unavailable' | 'unconfigured';

interface HeartbeatInput {
  configured: boolean;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorCode: string | null;
  now: Date;
}

interface QueueInput {
  pending: number;
  failed: number;
  oldestPendingAt: Date | null;
  now: Date;
}

export interface OperationalAssessment {
  status: OperationalHealthState;
  message: string;
}

const HEALTHY_HEARTBEAT_MS = 60_000;
const DEGRADED_HEARTBEAT_MS = 5 * 60_000;
const STALE_QUEUE_MS = 10 * 60_000;

export function assessHeartbeat(input: HeartbeatInput): OperationalAssessment {
  if (!input.configured) {
    return { status: 'unconfigured', message: 'Интеграция не настроена.' };
  }
  if (!input.lastSuccessAt) {
    return input.lastErrorCode
      ? { status: 'unavailable', message: 'Последняя попытка завершилась ошибкой.' }
      : { status: 'degraded', message: 'Успешных обновлений ещё не было.' };
  }

  const ageMs = Math.max(0, input.now.getTime() - input.lastSuccessAt.getTime());
  if (ageMs <= HEALTHY_HEARTBEAT_MS && !input.lastErrorCode) {
    return { status: 'healthy', message: 'Обновления поступают штатно.' };
  }
  if (ageMs <= DEGRADED_HEARTBEAT_MS) {
    return { status: 'degraded', message: 'Обновления поступают с задержкой.' };
  }
  return { status: 'unavailable', message: 'Обновления давно не поступали.' };
}

export function assessQueue(input: QueueInput): OperationalAssessment {
  if (input.failed > 0) {
    return { status: 'unavailable', message: 'В очереди есть задания с ошибками.' };
  }
  if (input.pending === 0) {
    return { status: 'healthy', message: 'Очередь обработана, ошибок нет.' };
  }
  const oldestAgeMs = input.oldestPendingAt
    ? Math.max(0, input.now.getTime() - input.oldestPendingAt.getTime())
    : 0;
  return oldestAgeMs >= STALE_QUEUE_MS
    ? { status: 'unavailable', message: 'Очередь не обрабатывается вовремя.' }
    : { status: 'degraded', message: 'Есть задания, ожидающие обработки.' };
}
