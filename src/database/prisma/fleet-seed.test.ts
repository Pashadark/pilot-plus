import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseFleetSource } from './fleet-import';
import { seedFleet } from './seed';

const source = readFileSync(new URL('./data/fleet-source.txt', import.meta.url), 'utf8');

function createFleetDatabase() {
  const companies = new Map<string, { id: string; slug: string }>();
  const memberships = new Map<string, { companyId: string; userId: string }>();
  const vehicles = new Map<string, Record<string, unknown>>();

  return {
    companies,
    memberships,
    vehicles,
    database: {
      company: {
        async upsert(args: {
          where: { slug: string };
          create: { name: string; slug: string };
          update: { name: string };
        }) {
          const company = companies.get(args.where.slug) ?? {
            id: 'pilot-demo-company',
            slug: args.create.slug,
          };
          companies.set(args.where.slug, company);
          return company;
        },
      },
      companyMember: {
        async upsert(args: {
          where: { companyId_userId: { companyId: string; userId: string } };
          create: { companyId: string; userId: string; role: 'ADMIN' };
          update: { role: 'ADMIN' };
        }) {
          const key = `${args.where.companyId_userId.companyId}:${args.where.companyId_userId.userId}`;
          memberships.set(key, args.create);
          return { id: key };
        },
      },
      vehicle: {
        async upsert(args: {
          where: { sourceKey: string };
          create: object;
          update: object;
        }) {
          vehicles.set(args.where.sourceKey, { ...args.create, ...args.update });
          return { id: args.where.sourceKey };
        },
      },
    },
  };
}

describe('seed автопарка', () => {
  it('идемпотентно связывает 130 автомобилей с компанией администратора', async () => {
    const fake = createFleetDatabase();
    const rows = parseFleetSource(source);

    const first = await seedFleet(fake.database, 'admin-user', rows);
    const second = await seedFleet(fake.database, 'admin-user', rows);

    expect(first).toEqual({ companyId: 'pilot-demo-company', vehicles: 130 });
    expect(second).toEqual(first);
    expect(fake.companies.size).toBe(1);
    expect(fake.memberships.size).toBe(1);
    expect(fake.vehicles.size).toBe(130);
    expect(fake.vehicles.get('fleet-001')).toMatchObject({
      companyId: 'pilot-demo-company',
      internalNumber: 'PLT-001',
      status: 'UNKNOWN',
      isDemoImport: true,
    });
  });
});
