import { describe, expect, it, vi } from 'vitest';

import { createOperationalHealthLoader } from './get-operational-health';

describe('getOperationalHealth', () => {
  it('возвращает GLONASSSoft и безопасные агрегаты очередей', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      glonasssoft: {
        configuredCount: 1,
        linkedVehicles: 10,
        lastAttemptAt: new Date('2026-08-27T18:04:55.000Z'),
        lastSuccessAt: new Date('2026-08-27T18:04:55.000Z'),
        lastErrorCode: null,
      },
      rentalDocuments: {
        pending: 2,
        failed: 0,
        oldestPendingAt: new Date('2026-08-31T11:59:00Z'),
        libreOfficeAvailable: true,
        missingPdf: 3,
      },
      returnMedia: { pending: 0, failed: 0, oldestPendingAt: null },
      clientDocuments: { pending: 0, failed: 1, oldestPendingAt: null },
      telegram: { pending: 0, failed: 0, oldestPendingAt: null },
    });
    const getOperationalHealth = createOperationalHealthLoader(
      loadSnapshot,
      () => new Date('2026-08-31T12:00:00.000Z'),
    );

    const result = await getOperationalHealth();

    expect(loadSnapshot).toHaveBeenCalledOnce();
    expect(result).toEqual([
      expect.objectContaining({ key: 'glonasssoft', status: 'unavailable' }),
      expect.objectContaining({ key: 'rental-documents', status: 'degraded' }),
      expect.objectContaining({ key: 'return-media', status: 'healthy' }),
      expect.objectContaining({ key: 'client-documents', status: 'unavailable' }),
      expect.objectContaining({ key: 'telegram', status: 'healthy' }),
    ]);
    expect(result[0]?.metrics).toEqual([
      { label: 'Интеграции', value: '1' },
      { label: 'Автомобили', value: '10' },
    ]);
    expect(result[1]).toMatchObject({
      key: 'rental-documents',
      status: 'degraded',
      metrics: [
        { label: 'Ожидают', value: '2' },
        { label: 'Ошибки', value: '0' },
        { label: 'Без PDF', value: '3' },
        { label: 'LibreOffice', value: 'Доступен' },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/password|username|baseUrl/i);
  });

  it('помечает PDF-конвейер недоступным, когда LibreOffice не найден', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      glonasssoft: {
        configuredCount: 0,
        linkedVehicles: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastErrorCode: null,
      },
      rentalDocuments: {
        pending: 0,
        failed: 0,
        oldestPendingAt: null,
        libreOfficeAvailable: false,
        missingPdf: 1,
      },
      returnMedia: { pending: 0, failed: 0, oldestPendingAt: null },
      clientDocuments: { pending: 0, failed: 0, oldestPendingAt: null },
      telegram: { pending: 0, failed: 0, oldestPendingAt: null },
    });
    const getOperationalHealth = createOperationalHealthLoader(
      loadSnapshot,
      () => new Date('2026-08-31T12:00:00.000Z'),
    );

    const result = await getOperationalHealth();

    expect(result.find((item) => item.key === 'rental-documents')).toMatchObject({
      status: 'unavailable',
      errorCode: 'RENTAL_PDF_PIPELINE',
      metrics: expect.arrayContaining([{ label: 'LibreOffice', value: 'Недоступен' }]),
    });
  });
});
