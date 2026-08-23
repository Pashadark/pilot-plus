import { describe, expect, it, vi } from 'vitest';

import { createLiveMapStream } from './live-stream';

describe('SSE живой карты', () => {
  it('отправляет снимок сразу и после tenant-события, затем освобождает подписку', async () => {
    const listeners: Array<() => void> = [];
    const subscriber = {
      subscribe: vi.fn(async (_channel: string, next: () => void) => {
        listeners.push(next);
      }),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
    };
    const loadSnapshot = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'vehicle-1', speedKph: 0 }])
      .mockResolvedValueOnce([{ id: 'vehicle-1', speedKph: 42 }]);
    const abort = new AbortController();
    const stream = createLiveMapStream({
      channels: ['pilot:map:company-a'],
      subscriber,
      loadSnapshot,
      signal: abort.signal,
      heartbeatMs: 60_000,
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const initial = decoder.decode((await reader.read()).value);
    expect(initial).toContain('event: snapshot');
    expect(initial).toContain('"speedKph":0');

    listeners[0]?.();
    const updated = decoder.decode((await reader.read()).value);
    expect(updated).toContain('"speedKph":42');

    abort.abort();
    await reader.read();
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('pilot:map:company-a');
    expect(subscriber.quit).toHaveBeenCalled();
  });
});
