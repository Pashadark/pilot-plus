import { describe, expect, it } from 'vitest';

import {
  newScanLeaseExpiresAt,
  safeReconciliationFailureMessage,
  staleUploadThresholdMs,
} from './recovery-policy';

describe('client document recovery policy', () => {
  it.each([
    [undefined, 15],
    ['invalid', 15],
    ['1', 5],
    ['30', 30],
    ['99999', 24 * 60],
  ])('bounds stale threshold %s to %i minutes', (configured, minutes) => {
    expect(staleUploadThresholdMs(configured)).toBe(minutes * 60_000);
  });

  it('creates an absolute durable lease from the supplied clock', () => {
    expect(newScanLeaseExpiresAt(new Date('2026-08-10T12:00:00.000Z'), 15 * 60_000)).toEqual(
      new Date('2026-08-10T12:15:00.000Z'),
    );
  });

  it('returns actionable Russian CLI guidance without leaking the caught path or secret', () => {
    const message = safeReconciliationFailureMessage(
      new Error('C:\\private\\client-secret.pdf database password'),
    );

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PRIVATE_STORAGE_ROOT');
    expect(message).toContain('повторите запуск');
    expect(message).not.toContain('private\\client-secret.pdf');
    expect(message).not.toContain('password');
  });
});
