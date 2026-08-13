import { describe, expect, it } from 'vitest';
import { approvedRentalFleet, seedApprovedRentalFleet } from './rental-fleet-seed';

describe('approved rental fleet seed', () => {
  it('is idempotent, keeps exactly four active marked fixtures and never archives a manual vehicle', async () => {
    const records = new Map<string, Record<string, unknown>>([
      ['manual', { id: 'manual', sourceKey: 'manual:1', isDemoImport: false, archivedAt: null }],
      [
        'old-demo',
        { id: 'old-demo', sourceKey: 'example-fleet:old', isDemoImport: true, archivedAt: null },
      ],
    ]);
    const database = {
      vehicle: {
        findMany: async () =>
          [...records.values()].filter((item) => item.isDemoImport && item.archivedAt === null),
        upsert: async ({ where, create, update }: any) => {
          records.set(where.sourceKey, {
            ...(records.get(where.sourceKey) ?? create),
            ...update,
            ...create,
          });
          return { id: where.sourceKey };
        },
        updateMany: async ({ where, data }: any) => {
          for (const item of records.values())
            if (where.id.in.includes(item.id)) Object.assign(item, data);
          return { count: 1 };
        },
      },
    };
    await seedApprovedRentalFleet(database, 'demo-company');
    await seedApprovedRentalFleet(database, 'demo-company');
    const active = [...records.values()].filter(
      (item) => item.isDemoImport && item.archivedAt === null,
    );
    expect(active).toHaveLength(4);
    expect(new Set(active.map((item) => item.registrationNumberNormalized))).toHaveLength(4);
    expect(records.get('manual')?.archivedAt).toBeNull();
    expect(approvedRentalFleet.map((item) => item[3])).toEqual([
      'А429АУ97',
      'Е435АН997',
      'М283АМ997',
      'А156АХ997',
    ]);
  });
});
