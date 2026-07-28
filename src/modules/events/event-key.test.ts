import { describe, expect, it } from 'vitest';

import { createEventKey, parseEventKey } from './event-key';

describe('ключи событий', () => {
  it('создаёт стабильный ключ из источника и идентификатора', () => {
    expect(createEventKey('vehicle-event', 'abc')).toBe('vehicle-event:abc');
  });

  it('разбирает валидный ключ', () => {
    expect(parseEventKey('device-command:xyz')).toEqual({
      source: 'device-command',
      id: 'xyz',
    });
  });

  it('отклоняет небезопасный ключ', () => {
    expect(parseEventKey('../bad')).toBeNull();
  });
});
