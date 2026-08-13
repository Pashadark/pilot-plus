import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseFleetSource } from './fleet-import';
import { seedFleet } from './seed';
import type { VehicleImageManifestRow } from './vehicle-images';

const source = readFileSync(new URL('./data/fleet-source.txt', import.meta.url), 'utf8');

function createFleetDatabase() {
  const companies = new Map<string, { id: string; slug: string }>();
  const memberships = new Map<string, { companyId: string; userId: string }>();
  const vehicles = new Map<string, Record<string, unknown>>();
  const vehicleImages = new Map<string, Record<string, unknown>>();
  const membershipUpserts: Array<{
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }> = [];
  const companyUpserts: Array<{
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }> = [];

  return {
    companies,
    memberships,
    vehicles,
    vehicleImages,
    membershipUpserts,
    companyUpserts,
    database: {
      company: {
        async upsert(args: {
          where: { slug: string };
          create: Record<string, unknown> & { slug: string };
          update: Record<string, unknown>;
        }) {
          companyUpserts.push(args);
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
          create: {
            companyId: string;
            userId: string;
            role: 'COMPANY_ADMIN';
            additionalPermissions: [];
          };
          update: { role: 'COMPANY_ADMIN' };
        }) {
          const key = `${args.where.companyId_userId.companyId}:${args.where.companyId_userId.userId}`;
          membershipUpserts.push(args);
          memberships.set(key, args.create);
          return { id: key };
        },
      },
      vehicle: {
        async upsert(args: { where: { sourceKey: string }; create: object; update: object }) {
          vehicles.set(args.where.sourceKey, { ...args.create, ...args.update });
          return { id: args.where.sourceKey };
        },
      },
      vehicleImage: {
        async upsert(args: {
          where: { vehicleId_position: { vehicleId: string; position: number } };
          create: {
            vehicleId: string;
            localPath: string;
            sourceUrl: string;
            alt: string;
            position: number;
            isPrimary: boolean;
          };
          update: {
            localPath: string;
            sourceUrl: string;
            alt: string;
            position: number;
            isPrimary: boolean;
          };
        }) {
          const key = `${args.where.vehicleId_position.vehicleId}:${args.where.vehicleId_position.position}`;
          vehicleImages.set(key, { ...args.create, ...args.update });
          return { id: key };
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

    expect(first).toEqual({ companyId: 'pilot-demo-company', vehicles: 130, images: 0 });
    expect(second).toEqual(first);
    expect(fake.companies.size).toBe(1);
    expect(fake.memberships.size).toBe(1);
    expect(fake.membershipUpserts[0]?.create.role).toBe('COMPANY_ADMIN');
    expect(fake.membershipUpserts[0]?.create.additionalPermissions).toEqual([]);
    expect(fake.membershipUpserts[0]?.update.role).toBe('COMPANY_ADMIN');
    expect(fake.companyUpserts[0]?.create).toMatchObject({
      name: 'DEMO ONLY ООО «Пилот Рент»',
      slug: 'pilot-demo',
      inn: '0000000000',
      kpp: '000000000',
      ogrn: '0000000000000',
      directorName: 'DEMO ONLY Администратор',
      legalAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
      actualAddress: 'DEMO ONLY, г. Москва, ул. Демо, д. 1',
      phone: '+7 (000) 000-00-00',
      email: 'office@pilot-demo.example.test',
      isDemo: true,
    });
    expect(fake.companyUpserts[0]?.update).toEqual({ isDemo: true });
    expect(fake.vehicles.size).toBe(130);
    expect(fake.vehicles.get('fleet-001')).toMatchObject({
      companyId: 'pilot-demo-company',
      internalNumber: 'PLT-001',
      status: 'UNKNOWN',
      isDemoImport: true,
    });
  });

  it('идемпотентно связывает фотографии с идентификаторами автомобилей', async () => {
    const fake = createFleetDatabase();
    const rows = parseFleetSource(source).slice(0, 2);
    const images: VehicleImageManifestRow[] = rows.map((row) => ({
      sourceKey: row.sourceKey,
      model: row.model,
      city: row.city,
      sourceUrl: `https://autopilotrent.ru/photos/${row.sourceKey}.webp`,
      localPath: `/vehicles/test/${row.sourceKey}/primary.webp`,
      alt: `${row.model} — ${row.city}`,
      position: 0,
      isPrimary: true,
    }));

    const first = await seedFleet(fake.database, 'admin-user', rows, images);
    const second = await seedFleet(fake.database, 'admin-user', rows, images);

    expect(first).toEqual({ companyId: 'pilot-demo-company', vehicles: 2, images: 2 });
    expect(second).toEqual(first);
    expect(fake.vehicleImages.size).toBe(2);
    expect(fake.vehicleImages.get('fleet-001:0')).toMatchObject({
      vehicleId: 'fleet-001',
      position: 0,
      isPrimary: true,
    });
  });
});
