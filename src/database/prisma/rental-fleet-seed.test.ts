import { describe, expect, it } from 'vitest';
import {
  approvedRentalFleet,
  type RentalFleetSeedDatabase,
  seedApprovedRentalFleet,
  seedDemoCompanyContractDefaults,
} from './rental-fleet-seed';

describe('approved rental fleet seed', () => {
  it('is idempotent, keeps exactly four active marked fixtures and never archives a manual vehicle', async () => {
    const records = new Map<string, Record<string, unknown>>([
      ['manual', { id: 'manual', sourceKey: 'manual:1', isDemoImport: false, archivedAt: null }],
      [
        'old-demo',
        { id: 'old-demo', sourceKey: 'example-fleet:old', isDemoImport: true, archivedAt: null },
      ],
    ]);
    type FleetUpsertArgs = {
      where: { sourceKey: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    type FleetUpdateArgs = {
      where: { id: { in: readonly string[] } };
      data: Record<string, unknown>;
    };
    const database = {
      vehicle: {
        findMany: async () =>
          [...records.values()].filter((item) => item.isDemoImport && item.archivedAt === null),
        upsert: async ({ where, create, update }: FleetUpsertArgs) => {
          records.set(where.sourceKey, {
            ...(records.get(where.sourceKey) ?? create),
            ...update,
            ...create,
          });
          return { id: where.sourceKey };
        },
        updateMany: async ({ where, data }: FleetUpdateArgs) => {
          for (const item of records.values())
            if (where.id.in.includes(String(item.id))) Object.assign(item, data);
          return { count: 1 };
        },
      },
    };
    await seedApprovedRentalFleet(database as unknown as RentalFleetSeedDatabase, 'demo-company');
    await seedApprovedRentalFleet(database as unknown as RentalFleetSeedDatabase, 'demo-company');
    const active = [...records.values()].filter(
      (item) => item.isDemoImport && item.archivedAt === null,
    );
    expect(active).toHaveLength(4);
    expect(new Set(active.map((item) => item.registrationNumberNormalized))).toHaveLength(4);
    expect(new Set(active.map((item) => String(item.vin)))).toHaveLength(4);
    for (const vehicle of active) {
      expect(vehicle.vin).toMatch(/^DEMO[A-Z0-9]{13}$/u);
      expect(vehicle.registrationCertificateNumber).toMatch(/^DEMO-STS-\d{2}$/u);
      expect(vehicle.vehiclePassportNumber).toMatch(/^DEMO-PTS-\d{2}$/u);
      expect(vehicle.osagoInsurer).toBe('DEMO ONLY Insurance');
      expect(vehicle.cascoInsurer).toBe('DEMO ONLY Insurance');
      expect(vehicle.osagoStartsAt).toEqual(new Date('2026-01-01'));
      expect(vehicle.osagoEndsAt).toEqual(new Date('2030-12-31'));
      expect(vehicle.cascoStartsAt).toEqual(new Date('2026-01-01'));
      expect(vehicle.cascoEndsAt).toEqual(new Date('2030-12-31'));
      expect(vehicle.isRentalReady).toBe(true);
      expect(vehicle.dailyPriceMinor).toBeGreaterThan(0);
      expect(vehicle.depositMinor).toBeGreaterThan(BigInt(0));
    }
    expect(records.get('manual')?.archivedAt).toBeNull();
    expect(approvedRentalFleet.map((item) => item[3])).toEqual([
      'А429АУ97',
      'Е435АН997',
      'М283АМ997',
      'А156АХ997',
    ]);
  });

  it('fills only absent contract defaults for a demo company and leaves configured values intact', async () => {
    const company: Record<string, unknown> = {
      id: 'demo-company',
      isDemo: true,
      legalName: null,
      inn: null,
      ogrn: null,
      legalAddress: null,
      actualAddress: null,
      bankName: null,
      settlementAccount: null,
      correspondentAccount: null,
      bik: null,
      contractCity: null,
      defaultPickupAddress: 'Настроенный адрес выдачи',
      defaultReturnAddress: null,
      signatoryName: null,
      signatoryAuthority: null,
    };
    const database = {
      company: {
        findUnique: async () => company,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(company, data);
          return company;
        },
      },
    };

    await seedDemoCompanyContractDefaults(database, 'demo-company');

    expect(company).toMatchObject({
      legalName: 'DEMO ONLY ООО «Пилот Рент»',
      inn: '0000000000',
      ogrn: '0000000000000',
      legalAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
      actualAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
      bankName: 'DEMO ONLY БАНК',
      settlementAccount: '00000000000000000000',
      correspondentAccount: '00000000000000000000',
      bik: '000000000',
      contractCity: 'Москва',
      defaultReturnAddress: 'DEMO ONLY, Москва, пункт возврата',
      signatoryName: 'DEMO ONLY Подписант',
      signatoryAuthority: 'Устав (DEMO ONLY)',
    });
    expect(company.defaultPickupAddress).toBe('Настроенный адрес выдачи');
    expect(company.defaultReturnAddress).toMatch(/^DEMO ONLY/u);
    expect(company.signatoryName).toMatch(/^DEMO ONLY/u);
    expect(company.lessorPassportEncrypted).toBeUndefined();
  });

  it('does not update a non-demo company', async () => {
    let updated = false;
    const result = await seedDemoCompanyContractDefaults(
      {
        company: {
          findUnique: async () => ({ id: 'real-company', isDemo: false }),
          update: async () => {
            updated = true;
            return {};
          },
        },
      },
      'real-company',
    );

    expect(result).toEqual({ updated: false });
    expect(updated).toBe(false);
  });
});
