import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  isE2EErrorSeamEnabled,
  isValidE2EErrorId,
  triggerE2EErrorOnce,
} from './e2e-error-seam';

describe('test-only seam error boundary', () => {
  it('включается только явным флагом и никогда в production', () => {
    expect(isE2EErrorSeamEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(
      isE2EErrorSeamEnabled({ NODE_ENV: 'development', PILOT_E2E_ERROR_SEAM: '1' }),
    ).toBe(true);
    expect(isE2EErrorSeamEnabled({ NODE_ENV: 'test', PILOT_E2E_ERROR_SEAM: '1' })).toBe(true);
    expect(isE2EErrorSeamEnabled({ NODE_ENV: 'production', PILOT_E2E_ERROR_SEAM: '1' })).toBe(
      false,
    );
  });

  it('принимает только ограниченный opaque id', () => {
    expect(isValidE2EErrorId(randomUUID())).toBe(true);
    expect(isValidE2EErrorId(undefined)).toBe(false);
    expect(isValidE2EErrorId('../secret')).toBe(false);
    expect(isValidE2EErrorId('x'.repeat(101))).toBe(false);
  });

  it('падает ровно один раз для уникального id', () => {
    const id = randomUUID();

    expect(() => triggerE2EErrorOnce(id)).toThrow('PILOT_E2E_PROTECTED_BOUNDARY');
    expect(() => triggerE2EErrorOnce(id)).not.toThrow();
  });
});
