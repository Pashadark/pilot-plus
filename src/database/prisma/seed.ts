import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { prisma } from './client';
import { parseFleetSource, type FleetImportRow } from './fleet-import';
import { hashPassword } from '@/services/auth/password';

interface SeedEnvironment {
  [key: string]: string | undefined;
  PILOT_ADMIN_EMAIL?: string;
  PILOT_ADMIN_PASSWORD?: string;
  PILOT_ADMIN_NAME?: string;
}

interface UserRepository {
  findUnique(args: { where: { email: string } }): Promise<{ id: string } | null>;
  upsert(args: {
    where: { email: string };
    create: {
      email: string;
      name: string;
      passwordHash: string;
      role: 'ADMIN';
      isActive: true;
    };
    update: {
      name: string;
      passwordHash: string;
      role: 'ADMIN';
      isActive: true;
    };
  }): Promise<{ id: string }>;
}

interface AdminSeedDatabase {
  user: UserRepository;
}

interface FleetSeedDatabase {
  company: {
    upsert(args: {
      where: { slug: string };
      create: { name: string; slug: string };
      update: { name: string };
    }): Promise<{ id: string }>;
  };
  companyMember: {
    upsert(args: {
      where: { companyId_userId: { companyId: string; userId: string } };
      create: { companyId: string; userId: string; role: 'ADMIN' };
      update: { role: 'ADMIN' };
    }): Promise<unknown>;
  };
  vehicle: {
    upsert(args: {
      where: { sourceKey: string };
      create: VehicleSeedData;
      update: Omit<VehicleSeedData, 'sourceKey'>;
    }): Promise<unknown>;
  };
}

interface VehicleSeedData extends FleetImportRow {
  companyId: string;
  internalNumber: string;
  status: 'UNKNOWN';
  isDemoImport: true;
}

function requireEnvironmentValue(environment: SeedEnvironment, key: keyof SeedEnvironment) {
  const value = environment[key]?.trim();

  if (!value) {
    throw new Error(`Не задана обязательная переменная ${key}.`);
  }

  return value;
}

export async function seedAdmin(
  environment: SeedEnvironment,
  database: AdminSeedDatabase,
): Promise<{ email: string; created: boolean; userId: string }> {
  const email = requireEnvironmentValue(environment, 'PILOT_ADMIN_EMAIL').toLowerCase();
  const password = requireEnvironmentValue(environment, 'PILOT_ADMIN_PASSWORD');
  const name = requireEnvironmentValue(environment, 'PILOT_ADMIN_NAME');

  if (password.length < 12) {
    throw new Error('Пароль должен содержать не менее 12 символов.');
  }

  const existingUser = await database.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);

  const user = await database.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: 'ADMIN', isActive: true },
    update: { name, passwordHash, role: 'ADMIN', isActive: true },
  });

  return { email, created: existingUser === null, userId: user.id };
}

export async function seedFleet(
  database: FleetSeedDatabase,
  adminUserId: string,
  rows: readonly FleetImportRow[],
): Promise<{ companyId: string; vehicles: number }> {
  const company = await database.company.upsert({
    where: { slug: 'pilot-demo' },
    create: { name: 'Pilot+ Demo', slug: 'pilot-demo' },
    update: { name: 'Pilot+ Demo' },
  });

  await database.companyMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: adminUserId } },
    create: { companyId: company.id, userId: adminUserId, role: 'ADMIN' },
    update: { role: 'ADMIN' },
  });

  for (const [index, row] of rows.entries()) {
    const data: VehicleSeedData = {
      ...row,
      companyId: company.id,
      internalNumber: `PLT-${String(index + 1).padStart(3, '0')}`,
      status: 'UNKNOWN',
      isDemoImport: true,
    };
    const update: Omit<VehicleSeedData, 'sourceKey'> = {
      companyId: data.companyId,
      internalNumber: data.internalNumber,
      model: data.model,
      city: data.city,
      office: data.office,
      transmission: data.transmission,
      engineLiters: data.engineLiters,
      fuelType: data.fuelType,
      seats: data.seats,
      dailyPriceMinor: data.dailyPriceMinor,
      currency: data.currency,
      originalPrice: data.originalPrice,
      features: data.features,
      status: data.status,
      isDemoImport: data.isDemoImport,
    };

    await database.vehicle.upsert({
      where: { sourceKey: row.sourceKey },
      create: data,
      update,
    });
  }

  return { companyId: company.id, vehicles: rows.length };
}

async function main() {
  try {
    const admin = await seedAdmin(process.env, prisma);
    const action = admin.created ? 'создан' : 'обновлён';
    console.info(`Администратор ${admin.email} ${action}.`);

    const source = readFileSync(new URL('./data/fleet-source.txt', import.meta.url), 'utf8');
    const fleet = await seedFleet(prisma, admin.userId, parseFleetSource(source));
    console.info(`Импортировано автомобилей: ${fleet.vehicles}. Компания: ${fleet.companyId}.`);
  } finally {
    await prisma.$disconnect();
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка seed.';
    console.error(`Не удалось создать администратора: ${message}`);
    process.exitCode = 1;
  });
}
