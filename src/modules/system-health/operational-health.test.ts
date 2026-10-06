import { describe, expect, it } from 'vitest';

import { assessHeartbeat, assessQueue } from './operational-health';

describe('assessHeartbeat', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');

  it('помечает недавно успешный worker как работающий', () => {
    expect(
      assessHeartbeat({
        configured: true,
        lastAttemptAt: new Date('2026-08-31T11:59:58.000Z'),
        lastSuccessAt: new Date('2026-08-31T11:59:58.000Z'),
        lastErrorCode: null,
        now,
      }),
    ).toEqual({ status: 'healthy', message: 'Обновления поступают штатно.' });
  });

  it('показывает остановившийся worker как недоступный', () => {
    expect(
      assessHeartbeat({
        configured: true,
        lastAttemptAt: new Date('2026-08-27T18:04:55.000Z'),
        lastSuccessAt: new Date('2026-08-27T18:04:55.000Z'),
        lastErrorCode: null,
        now,
      }),
    ).toEqual({ status: 'unavailable', message: 'Обновления давно не поступали.' });
  });

  it('не выдаёт отсутствие настройки за аварию', () => {
    expect(
      assessHeartbeat({
        configured: false,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastErrorCode: null,
        now,
      }),
    ).toEqual({ status: 'unconfigured', message: 'Интеграция не настроена.' });
  });
});

describe('assessQueue', () => {
  it('считает чистую очередь исправной', () => {
    expect(assessQueue({ pending: 0, failed: 0, oldestPendingAt: null, now: new Date() })).toEqual({
      status: 'healthy',
      message: 'Очередь обработана, ошибок нет.',
    });
  });

  it('предупреждает о растущей очереди', () => {
    expect(
      assessQueue({
        pending: 3,
        failed: 0,
        oldestPendingAt: new Date('2026-08-31T11:55:00.000Z'),
        now: new Date('2026-08-31T12:00:00.000Z'),
      }),
    ).toEqual({ status: 'degraded', message: 'Есть задания, ожидающие обработки.' });
  });

  it('поднимает аварию при ошибках', () => {
    expect(assessQueue({ pending: 1, failed: 2, oldestPendingAt: null, now: new Date() })).toEqual({
      status: 'unavailable',
      message: 'В очереди есть задания с ошибками.',
    });
  });
});
