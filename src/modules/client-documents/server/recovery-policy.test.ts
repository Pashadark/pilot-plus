import { describe, expect, it } from 'vitest';

import {
  maxQuarantineScanRetries,
  newScanLeaseExpiresAt,
  quarantineRetentionMs,
  safeReconciliationFailureMessage,
  scanRetryDelayMs,
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

  it('keeps ERROR quarantine for a bounded retention window', () => {
    expect(quarantineRetentionMs(undefined)).toBe(24 * 60 * 60_000);
    expect(quarantineRetentionMs('0')).toBe(60 * 60_000);
    expect(quarantineRetentionMs('999')).toBe(7 * 24 * 60 * 60_000);
  });

  it('bounds retry attempts and exponential delay', () => {
    expect(maxQuarantineScanRetries(undefined)).toBe(3);
    expect(maxQuarantineScanRetries('99')).toBe(10);
    expect(scanRetryDelayMs(0)).toBe(5 * 60_000);
    expect(scanRetryDelayMs(3)).toBe(40 * 60_000);
  });
});
