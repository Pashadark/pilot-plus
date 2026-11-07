import { describe, expect, it } from 'vitest';

import { getClientFineWorkspace } from './client-fines';

const access = {
  scope: 'COMPANY' as const,
  companyIds: ['company-1'],
};

describe('getClientFineWorkspace', () => {
  it('returns only confirmed client fines inside the permitted company', async () => {
    let query: unknown;
    const repository = {
      async findMany(args: unknown) {
        query = args;
        return [
          {
            id: 'fine-1',
            decreeNumber: '18810550260831038048',
            decreeAt: new Date('2026-08-28T09:00:00.000Z'),
            offenseAt: new Date('2026-08-27T10:29:00.000Z'),
            currentAmountMinor: BigInt(56250),
            originalAmountMinor: BigInt(75000),
            status: 'UNPAID',
            description: 'Превышение скорости движения ТС от 20 до 40 км/ч',
            articleCode: '12.9 ч.2',
            address: 'М-5 «Урал», 118 км + 470 м',
            assignmentConfirmedAt: new Date('2026-08-29T08:00:00.000Z'),
            assignmentSource: 'MANUAL',
            vehicle: {
              id: 'vehicle-1',
              make: 'Mercedes-Benz',
              modelName: 'E 220 d 4MATIC',
              model: 'E 220 d 4MATIC',
              registrationNumber: 'М283АМ997',
            },
            rental: {
              id: 'rental-1',
              contractNumber: 'ME-2026-0061-VK',
              startsAt: new Date('2026-08-25T08:00:00.000Z'),
              endsAt: new Date('2026-08-30T16:00:00.000Z'),
            },
          },
          {
            id: 'fine-2',
            decreeNumber: '18810550260831038049',
            decreeAt: null,
            offenseAt: new Date('2026-08-20T10:00:00.000Z'),
            currentAmountMinor: BigInt(500000),
            originalAmountMinor: BigInt(500000),
            status: 'PAID',
            description: 'Неправильная парковка',
            articleCode: null,
            address: null,
            assignmentConfirmedAt: new Date('2026-08-21T08:00:00.000Z'),
            assignmentSource: 'AUTO_EXACT',
            vehicle: null,
            rental: null,
          },
          {
            id: 'fine-3',
            decreeNumber: '18810550260831038050',
            decreeAt: null,
            offenseAt: new Date('2026-08-19T10:00:00.000Z'),
            currentAmountMinor: BigInt(300000),
            originalAmountMinor: BigInt(300000),
            status: 'ARCHIVED',
            description: 'Исчез из реестра провайдера',
            articleCode: null,
            address: null,
            assignmentConfirmedAt: new Date('2026-08-20T08:00:00.000Z'),
            assignmentSource: 'MANUAL',
            vehicle: null,
            rental: null,
          },
        ];
      },
    };

    const result = await getClientFineWorkspace(
      access,
      'company-1',
      'client-1',
      repository,
    );

    expect(query).toMatchObject({
      where: {
        companyId: 'company-1',
        clientId: 'client-1',
        assignmentConfirmedAt: { not: null },
        status: { not: 'CANCELLED' },
      },
    });
    expect(result.summary).toEqual({ total: 3, unpaid: 1, unpaidAmountMinor: '56250' });
    expect(result.fines[0]).toMatchObject({
      id: 'fine-1',
      decreeNumber: '18810550260831038048',
      currentAmountMinor: '56250',
      vehicle: {
        id: 'vehicle-1',
        label: 'Mercedes-Benz E 220 d 4MATIC',
        registrationNumber: 'М283АМ997',
      },
      rental: { id: 'rental-1', contractNumber: 'ME-2026-0061-VK' },
    });
  });

  it('rejects access to another company before querying fines', async () => {
    let called = false;
    const repository = {
      async findMany() {
        called = true;
        return [];
      },
    };

    await expect(
      getClientFineWorkspace(access, 'company-2', 'client-1', repository),
    ).rejects.toThrow('Доступ к штрафам клиента запрещён.');
    expect(called).toBe(false);
  });
});
