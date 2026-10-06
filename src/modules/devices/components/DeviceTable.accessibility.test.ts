import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('таблица устройств', () => {
  it('не выносит визуально скрытый заголовок действий за границы документа', () => {
    const source = readFileSync(new URL('./DeviceTable.tsx', import.meta.url), 'utf8');

    expect(source).toContain('aria-label="Действия"');
    expect(source).not.toContain('<span className="sr-only">Действия</span>');
  });
});
