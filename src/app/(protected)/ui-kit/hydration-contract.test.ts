import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('контракт гидратации UI-kit', () => {
  it('задаёт явную локаль для чисел, отрисованных сервером и браузером', () => {
    const source = readFileSync(new URL('./sections.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/\.toLocaleString\(\)/u);
  });
});
