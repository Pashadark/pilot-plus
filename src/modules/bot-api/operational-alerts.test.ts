import { describe, expect, it } from 'vitest';

import {
  classifyGpsSilence,
  classifyRentalDeadline,
  formatOperationalAlert,
} from './operational-alerts';

describe('operational alert thresholds', () => {
  it('does not alarm for short GPS silence and escalates rented vehicles', () => {
    expect(classifyGpsSilence({ isRented: true, silentForMs: 5 * 60 * 60_000 })).toBeNull();
    expect(classifyGpsSilence({ isRented: true, silentForMs: 6 * 60 * 60_000 })).toBe(
      'RENTED_GPS_WARNING',
    );
    expect(classifyGpsSilence({ isRented: true, silentForMs: 24 * 60 * 60_000 })).toBe(
      'RENTED_GPS_CRITICAL',
    );
    expect(classifyGpsSilence({ isRented: true, silentForMs: 48 * 60 * 60_000 })).toBe(
      'RENTED_GPS_THEFT_RISK',
    );
  });

  it('only warns for a free vehicle after 48 hours without GPS', () => {
    expect(classifyGpsSilence({ isRented: false, silentForMs: 47 * 60 * 60_000 })).toBeNull();
    expect(classifyGpsSilence({ isRented: false, silentForMs: 48 * 60 * 60_000 })).toBe(
      'FREE_GPS_TRACKER_PROBLEM',
    );
  });

  it('alerts two hours before a return and escalates two hours after it', () => {
    expect(classifyRentalDeadline(-3 * 60 * 60_000)).toBeNull();
    expect(classifyRentalDeadline(-2 * 60 * 60_000)).toBe('RETURN_SOON');
    expect(classifyRentalDeadline(30 * 60_000)).toBeNull();
    expect(classifyRentalDeadline(2 * 60 * 60_000)).toBe('RETURN_OVERDUE');
  });

  it('formats a concrete safe action for a critical rented vehicle', () => {
    const message = formatOperationalAlert({
      kind: 'RENTED_GPS_THEFT_RISK',
      vehicle: 'Mercedes <E220>',
      registrationNumber: 'М283АМ997',
      silentForMs: 49 * 60 * 60_000,
      clientName: 'Петров & сын',
      clientPhone: '+7 900 000-00-00',
    });

    expect(message).toContain('🔴 <b>Срочно: машина без связи более 48 часов</b>');
    expect(message).toContain('Mercedes &lt;E220&gt;');
    expect(message).toContain('Петров &amp; сын');
    expect(message).toContain('Срочно позвонить клиенту');
    expect(message).not.toContain('<E220>');
  });
});
