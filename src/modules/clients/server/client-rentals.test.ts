import { describe, expect, it, vi } from 'vitest';

import { getClientRentalWorkspace } from './client-rentals';

describe('история аренд клиента', () => {
  it('ограничивает выборку клиентом и tenant и возвращает только готовые документы', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'rental-1',
        contractNumber: 'ME-2026-0001-BK',
        status: 'COMPLETED',
        startsAt: new Date('2026-08-01T09:00:00.000Z'),
        endsAt: new Date('2026-08-03T09:00:00.000Z'),
        billableDays: 2,
        totalPriceMinor: BigInt(250000),
        depositMinor: BigInt(100000),
        currency: 'RUB',
        vehicle: { make: 'Kia', modelName: "Cee'd", registrationNumber: 'А123АА77' },
        documentVersions: [
          { version: 1, format: 'DOCX', clientDocumentVersion: { scanVerdict: 'CLEAN' } },
          { version: 1, format: 'PDF', clientDocumentVersion: { scanVerdict: 'CLEAN' } },
          { version: 2, format: 'PDF', clientDocumentVersion: { scanVerdict: 'ERROR' } },
        ],
        operations: [
          {
            id: 'operation-1',
            type: 'HANDOVER',
            occurredAt: new Date('2026-08-01T09:00:00.000Z'),
            mileageKm: 10000,
            fuelLevelPercent: 80,
            evidenceStatus: 'MISSING',
            evidenceMissingReason: 'Телефон разрядился',
            actor: { name: 'Павел Седов' },
          },
        ],
      },
    ]);

    const result = await getClientRentalWorkspace(
      { scope: 'COMPANY', companyIds: ['company-1'] },
      'client-1',
      { findMany },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'client-1', companyId: { in: ['company-1'] } },
      }),
    );
    expect(result.summary).toEqual({ total: 1, active: 0, completed: 1, totalMinor: '250000' });
    expect(result.rentals[0]?.documents).toEqual([
      { version: 1, format: 'DOCX' },
      { version: 1, format: 'PDF' },
    ]);
    expect(result.rentals[0]?.vehicle.label).toBe("Kia Cee'd");
    expect(result.rentals[0]?.operations).toEqual([
      expect.objectContaining({
        id: 'operation-1',
        type: 'HANDOVER',
        mileageKm: 10000,
        evidenceStatus: 'MISSING',
        actorName: 'Павел Седов',
      }),
    ]);
  });

  it('для суперадминистратора не добавляет company filter', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await getClientRentalWorkspace({ scope: 'SYSTEM', companyIds: [] }, 'client-1', { findMany });
    expect(findMany.mock.calls[0]?.[0].where).toEqual({ clientId: 'client-1' });
  });
});
