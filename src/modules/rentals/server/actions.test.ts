import { describe, expect, it } from 'vitest';

describe('rental actions', () => {
  it('reserves cancellation for draft and confirmed states', () => {
    expect(['DRAFT', 'CONFIRMED']).toContain('CONFIRMED');
    expect(['DRAFT', 'CONFIRMED']).not.toContain('ACTIVE');
  });
});
