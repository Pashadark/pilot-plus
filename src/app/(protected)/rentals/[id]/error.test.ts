import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('rental detail error boundary', () => {
  it('is declared as a client component for the Next error boundary convention', () => {
    const source = readFileSync(new URL('./error.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/^['"]use client['"];?/u);
  });
});
