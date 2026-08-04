import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { prisma } from './client';
import { seedPilotConnectDevices } from './device-seed';
import { seedVehicleEventTimeline } from './event-timeline-seed';
import { parseFleetSource, type FleetImportRow } from './fleet-import';
import { parseVehicleImageManifest, type VehicleImageManifestRow } from './vehicle-images';
import { hashPassword } from '@/services/auth/password';
import { blindIndex, encryptField } from '@/services/security/field-encryption';
import { normalizeRussianPhone } from '@/shared/utils/phone';

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
      role: 'SUPER_ADMIN';
      isActive: true;
    };
    update: {
      name: string;
      passwordHash: string;
      role: 'SUPER_ADMIN';
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
      create: DemoCompanyData;
      update: Omit<DemoCompanyData, 'slug'>;
    }): Promise<{ id: string }>;
  };
  companyMember: {
    upsert(args: {
      where: { companyId_userId: { companyId: string; userId: string } };
      create: {
        companyId: string;
        userId: string;
        role: 'COMPANY_ADMIN';
        additionalPermissions: [];
      };
      update: { role: 'COMPANY_ADMIN' };
    }): Promise<unknown>;
  };
  vehicle: {
    upsert(args: {
      where: { sourceKey: string };
      create: VehicleSeedData;
      update: Omit<VehicleSeedData, 'sourceKey'>;
    }): Promise<{ id: string }>;
  };
  vehicleImage: {
    upsert(args: {
      where: { vehicleId_position: { vehicleId: string; position: number } };
      create: VehicleImageSeedData;
      update: Omit<VehicleImageSeedData, 'vehicleId'>;
    }): Promise<unknown>;
  };
}

export const demoCompanyData = {
  name: 'ООО «Север Транс Мониторинг»',
  slug: 'pilot-demo',
  inn: '2465357184',
  kpp: '246501001',
  ogrn: '1242400017356',
  directorName: 'Александр Сергеевич Лебедев',
  legalAddress: '660049, Красноярский край, г. Красноярск, ул. Карла Маркса, д. 93, офис 412',
  actualAddress: '660020, Красноярский край, г. Красноярск, ул. Шахтёров, д. 33, стр. 2',
  phone: '+7 (391) 205-17-40',
  email: 'office@sever-trans.demo',
  isDemo: true,
} as const;

type DemoCompanyData = typeof demoCompanyData;

type DemoCompanyRole = 'COMPANY_ADMIN' | 'DISPATCHER' | 'DRIVER' | 'VIEWER';

type DemoTeamProfile = {
  readonly email: string;
  readonly name: string;
  readonly companyRole: DemoCompanyRole;
};

const demoTeamProfiles: readonly DemoTeamProfile[] = [
  {
    email: 'anna.vorontsova@sever-trans.demo',
    name: 'Анна Воронцова',
    companyRole: 'COMPANY_ADMIN',
  },
  {
    email: 'maksim.orlov@sever-trans.demo',
    name: 'Максим Орлов',
    companyRole: 'DISPATCHER',
  },
  {
    email: 'dmitry.sokolov@sever-trans.demo',
    name: 'Дмитрий Соколов',
    companyRole: 'DRIVER',
  },
  {
    email: 'elena.mironova@sever-trans.demo',
    name: 'Елена Миронова',
    companyRole: 'VIEWER',
  },
];

interface DemoTeamSeedDatabase {
  user: {
    upsert(args: {
      where: { email: string };
      create: {
        email: string;
        name: string;
        passwordHash: string;
        role: 'MEMBER';
        isActive: false;
      };
      update: {
        name: string;
        role: 'MEMBER';
        isActive: false;
      };
    }): Promise<{ id: string }>;
  };
  companyMember: {
    upsert(args: {
      where: { companyId_userId: { companyId: string; userId: string } };
      create: {
        companyId: string;
        userId: string;
        role: DemoCompanyRole;
        additionalPermissions: [];
      };
      update: { role: DemoCompanyRole; additionalPermissions: [] };
    }): Promise<unknown>;
  };
}

type DemoClientStatus = 'DRAFT' | 'NEW' | 'VERIFYING' | 'VERIFIED' | 'REGULAR' | 'BLOCKED';

type DemoClientFixture = {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
  readonly passport: string;
  readonly driverLicense: string | null;
  readonly driverLicenseIssuedAt: Date | null;
  readonly driverLicenseExpiresAt: Date | null;
  readonly status: DemoClientStatus;
  readonly telegramUsername: string | null;
  readonly maxUserId: string | null;
};

type ClientSeedKeys = {
  encryptionKey: string;
  searchKey: string;
};

type DemoClientCreateData = {
  companyId: string;
  firstName: string;
  middleName: null;
  lastName: string;
  birthDate: null;
  phoneEncrypted: string;
  phoneIndex: string;
  email: string;
  telegramUsername: string | null;
  maxUserId: string | null;
  passportEncrypted: string;
  passportIndex: string;
  driverLicenseEncrypted: string | null;
  driverLicenseIndex: string | null;
  driverLicenseIssuedAt: Date | null;
  driverLicenseExpiresAt: Date | null;
  source: 'demo-fixture';
  note: string;
  status: DemoClientStatus;
  createdByUserId: string;
};

export interface ClientSeedDatabase {
  client: {
    upsert(args: {
      where: { companyId_phoneIndex: { companyId: string; phoneIndex: string } };
      create: DemoClientCreateData;
      update: Omit<DemoClientCreateData, 'companyId' | 'createdByUserId'>;
    }): Promise<unknown>;
  };
}

const demoClientFixtures: readonly DemoClientFixture[] = [
  {
    firstName: 'Демо',
    lastName: 'Клиент-01',
    phone: '79990000001',
    email: 'client-01@example.test',
    passport: 'DEMO-PASSPORT-01',
    driverLicense: null,
    driverLicenseIssuedAt: null,
    driverLicenseExpiresAt: null,
    status: 'DRAFT',
    telegramUsername: 'pilot_demo_client_01',
    maxUserId: null,
  },
  {
    firstName: 'Демо',
    lastName: 'Клиент-02',
    phone: '79990000002',
    email: 'client-02@example.test',
    passport: 'DEMO-PASSPORT-02',
    driverLicense: 'DEMO-LICENSE-02',
    driverLicenseIssuedAt: new Date('2020-02-01T00:00:00.000Z'),
    driverLicenseExpiresAt: new Date('2030-02-01T00:00:00.000Z'),
    status: 'NEW',
    telegramUsername: null,
    maxUserId: 'pilot-demo-max-02',
  },
  {
    firstName: 'Демо',
    lastName: 'Клиент-03',
    phone: '79990000003',
    email: 'client-03@example.test',
    passport: 'DEMO-PASSPORT-03',
    driverLicense: 'DEMO-LICENSE-03',
    driverLicenseIssuedAt: new Date('2018-03-01T00:00:00.000Z'),
    driverLicenseExpiresAt: new Date('2028-03-01T00:00:00.000Z'),
    status: 'VERIFYING',
    telegramUsername: 'pilot_demo_client_03',
    maxUserId: 'pilot-demo-max-03',
  },
  {
    firstName: 'Демо',
    lastName: 'Клиент-04',
    phone: '79990000004',
    email: 'client-04@example.test',
    passport: 'DEMO-PASSPORT-04',
    driverLicense: 'DEMO-LICENSE-04',
    driverLicenseIssuedAt: new Date('2017-04-01T00:00:00.000Z'),
    driverLicenseExpiresAt: new Date('2027-04-01T00:00:00.000Z'),
    status: 'VERIFIED',
    telegramUsername: null,
    maxUserId: 'pilot-demo-max-04',
  },
  {
    firstName: 'Демо',
    lastName: 'Клиент-05',
    phone: '79990000005',
    email: 'client-05@example.test',
    passport: 'DEMO-PASSPORT-05',
    driverLicense: 'DEMO-LICENSE-05',
    driverLicenseIssuedAt: new Date('2016-05-01T00:00:00.000Z'),
    driverLicenseExpiresAt: new Date('2026-12-01T00:00:00.000Z'),
    status: 'REGULAR',
    telegramUsername: 'pilot_demo_client_05',
    maxUserId: null,
  },
  {
    firstName: 'Демо',
    lastName: 'Клиент-06',
    phone: '79990000006',
    email: 'client-06@example.test',
    passport: 'DEMO-PASSPORT-06',
    driverLicense: 'DEMO-LICENSE-06',
    driverLicenseIssuedAt: new Date('2015-06-01T00:00:00.000Z'),
    driverLicenseExpiresAt: new Date('2025-06-01T00:00:00.000Z'),
    status: 'BLOCKED',
    telegramUsername: null,
    maxUserId: 'pilot-demo-max-06',
  },
];

function demoClientSeedKeys(environment: SeedEnvironment): ClientSeedKeys {
  return {
    encryptionKey: requireEnvironmentValue(environment, 'CLIENT_DATA_ENCRYPTION_KEY'),
    searchKey: requireEnvironmentValue(environment, 'CLIENT_SEARCH_KEY'),
  };
}

function demoClientData(
  fixture: DemoClientFixture,
  companyId: string,
  createdByUserId: string,
  keys: ClientSeedKeys,
): DemoClientCreateData {
  return {
    companyId,
    firstName: fixture.firstName,
    middleName: null,
    lastName: fixture.lastName,
    birthDate: null,
    phoneEncrypted: encryptField(fixture.phone, keys.encryptionKey),
    phoneIndex: blindIndex(fixture.phone, keys.searchKey, normalizeRussianPhone),
    email: fixture.email,
    telegramUsername: fixture.telegramUsername,
    maxUserId: fixture.maxUserId,
    passportEncrypted: encryptField(fixture.passport, keys.encryptionKey),
    passportIndex: blindIndex(fixture.passport, keys.searchKey, (value) => value),
    driverLicenseEncrypted: fixture.driverLicense
      ? encryptField(fixture.driverLicense, keys.encryptionKey)
      : null,
    driverLicenseIndex: fixture.driverLicense
      ? blindIndex(fixture.driverLicense, keys.searchKey, (value) => value)
      : null,
    driverLicenseIssuedAt: fixture.driverLicenseIssuedAt,
    driverLicenseExpiresAt: fixture.driverLicenseExpiresAt,
    source: 'demo-fixture',
    note: 'Явно тестовая демонстрационная карточка без персональных данных.',
    status: fixture.status,
    createdByUserId,
  };
}

function demoClientUpdateData(
  data: DemoClientCreateData,
): Omit<DemoClientCreateData, 'companyId' | 'createdByUserId'> {
  return {
    firstName: data.firstName,
    middleName: data.middleName,
    lastName: data.lastName,
    birthDate: data.birthDate,
    phoneEncrypted: data.phoneEncrypted,
    phoneIndex: data.phoneIndex,
    email: data.email,
    telegramUsername: data.telegramUsername,
    maxUserId: data.maxUserId,
    passportEncrypted: data.passportEncrypted,
    passportIndex: data.passportIndex,
    driverLicenseEncrypted: data.driverLicenseEncrypted,
    driverLicenseIndex: data.driverLicenseIndex,
    driverLicenseIssuedAt: data.driverLicenseIssuedAt,
    driverLicenseExpiresAt: data.driverLicenseExpiresAt,
    source: data.source,
    note: data.note,
    status: data.status,
  };
}

export async function seedDemoClients(
  database: ClientSeedDatabase,
  companyId: string,
  createdByUserId: string,
  keys: ClientSeedKeys,
): Promise<{ clients: number }> {
  for (const fixture of demoClientFixtures) {
    const data = demoClientData(fixture, companyId, createdByUserId, keys);
    const update = demoClientUpdateData(data);
    await database.client.upsert({
      where: { companyId_phoneIndex: { companyId, phoneIndex: data.phoneIndex } },
      create: data,
      update,
    });
  }

  return { clients: demoClientFixtures.length };
}

interface VehicleImageSeedData {
  vehicleId: string;
  localPath: string;
  sourceUrl: string;
  alt: string;
  position: number;
  isPrimary: boolean;
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
    create: { email, name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
    update: { name, passwordHash, role: 'SUPER_ADMIN', isActive: true },
  });

  return { email, created: existingUser === null, userId: user.id };
}

export async function seedFleet(
  database: FleetSeedDatabase,
  adminUserId: string,
  rows: readonly FleetImportRow[],
  imageRows: readonly VehicleImageManifestRow[] = [],
): Promise<{ companyId: string; vehicles: number; images: number }> {
  const company = await database.company.upsert({
    where: { slug: demoCompanyData.slug },
    create: demoCompanyData,
    update: {
      name: demoCompanyData.name,
      inn: demoCompanyData.inn,
      kpp: demoCompanyData.kpp,
      ogrn: demoCompanyData.ogrn,
      directorName: demoCompanyData.directorName,
      legalAddress: demoCompanyData.legalAddress,
      actualAddress: demoCompanyData.actualAddress,
      phone: demoCompanyData.phone,
      email: demoCompanyData.email,
      isDemo: demoCompanyData.isDemo,
    },
  });

  await database.companyMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: adminUserId } },
    create: {
      companyId: company.id,
      userId: adminUserId,
      role: 'COMPANY_ADMIN',
      additionalPermissions: [],
    },
    update: { role: 'COMPANY_ADMIN' },
  });

  const imagesBySourceKey = new Map<string, VehicleImageManifestRow[]>();
  for (const image of imageRows) {
    const images = imagesBySourceKey.get(image.sourceKey) ?? [];
    images.push(image);
    imagesBySourceKey.set(image.sourceKey, images);
  }

  let imageCount = 0;
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

    const vehicle = await database.vehicle.upsert({
      where: { sourceKey: row.sourceKey },
      create: data,
      update,
    });

    for (const image of imagesBySourceKey.get(row.sourceKey) ?? []) {
      const imageData: VehicleImageSeedData = {
        vehicleId: vehicle.id,
        localPath: image.localPath,
        sourceUrl: image.sourceUrl,
        alt: image.alt,
        position: image.position,
        isPrimary: image.isPrimary,
      };

      await database.vehicleImage.upsert({
        where: {
          vehicleId_position: { vehicleId: vehicle.id, position: image.position },
        },
        create: imageData,
        update: {
          localPath: image.localPath,
          sourceUrl: image.sourceUrl,
          alt: image.alt,
          position: image.position,
          isPrimary: image.isPrimary,
        },
      });
      imageCount += 1;
    }
  }

  return { companyId: company.id, vehicles: rows.length, images: imageCount };
}

export async function seedDemoTeam(
  database: DemoTeamSeedDatabase,
  companyId: string,
): Promise<{ users: number; memberships: number }> {
  const technicalPasswordHash = await hashPassword(randomBytes(32).toString('hex'));

  for (const profile of demoTeamProfiles) {
    const user = await database.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.name,
        passwordHash: technicalPasswordHash,
        role: 'MEMBER',
        isActive: false,
      },
      update: {
        name: profile.name,
        role: 'MEMBER',
        isActive: false,
      },
    });

    await database.companyMember.upsert({
      where: { companyId_userId: { companyId, userId: user.id } },
      create: {
        companyId,
        userId: user.id,
        role: profile.companyRole,
        additionalPermissions: [],
      },
      update: { role: profile.companyRole, additionalPermissions: [] },
    });
  }

  return { users: demoTeamProfiles.length, memberships: demoTeamProfiles.length };
}

async function main() {
  try {
    const admin = await seedAdmin(process.env, prisma);
    const action = admin.created ? 'создан' : 'обновлён';
    console.info(`Администратор ${admin.email} ${action}.`);

    const source = readFileSync(new URL('./data/fleet-source.txt', import.meta.url), 'utf8');
    const imageSource = readFileSync(
      new URL('./data/vehicle-images.json', import.meta.url),
      'utf8',
    );
    const fleet = await seedFleet(
      prisma,
      admin.userId,
      parseFleetSource(source),
      parseVehicleImageManifest(imageSource),
    );
    console.info(
      `Импортировано автомобилей: ${fleet.vehicles}; фотографий: ${fleet.images}. Компания: ${fleet.companyId}.`,
    );

    const demoTeam = await seedDemoTeam(prisma, fleet.companyId);
    console.info(`Демо-команда: ${demoTeam.users} профиля, ${demoTeam.memberships} членства.`);

    const demoClients = await seedDemoClients(
      prisma,
      fleet.companyId,
      admin.userId,
      demoClientSeedKeys(process.env),
    );
    console.info(`Демо-клиенты: ${demoClients.clients} карточек.`);

    const fleetVehicles = await prisma.vehicle.findMany({
      where: { companyId: fleet.companyId },
      orderBy: { internalNumber: 'asc' },
      take: 23,
      select: { id: true, internalNumber: true },
    });
    const devices = await seedPilotConnectDevices(
      prisma,
      fleet.companyId,
      admin.userId,
      fleetVehicles,
    );
    console.info(
      `Pilot Connect: ${devices.devices} устройств, ${devices.firmwareReleases} прошивки, ${devices.commands} команд`,
    );

    const timeline = await seedVehicleEventTimeline(
      prisma,
      fleet.companyId,
      admin.userId,
      fleetVehicles,
    );
    console.info(
      `История: ${timeline.trips} поездок, ${timeline.events} событий, ` +
        `${timeline.fuelRecords} операций с топливом, ${timeline.manualEvents} ручных записей`,
    );
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
