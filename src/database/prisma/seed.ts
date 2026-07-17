import { pathToFileURL } from 'node:url';

import { prisma } from './client';
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
  }): Promise<unknown>;
}

interface SeedDatabase {
  user: UserRepository;
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
  database: SeedDatabase,
): Promise<{ email: string; created: boolean }> {
  const email = requireEnvironmentValue(environment, 'PILOT_ADMIN_EMAIL').toLowerCase();
  const password = requireEnvironmentValue(environment, 'PILOT_ADMIN_PASSWORD');
  const name = requireEnvironmentValue(environment, 'PILOT_ADMIN_NAME');

  if (password.length < 12) {
    throw new Error('Пароль должен содержать не менее 12 символов.');
  }

  const existingUser = await database.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);

  await database.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: 'ADMIN', isActive: true },
    update: { name, passwordHash, role: 'ADMIN', isActive: true },
  });

  return { email, created: existingUser === null };
}

async function main() {
  try {
    const result = await seedAdmin(process.env, prisma);
    const action = result.created ? 'создан' : 'обновлён';
    console.info(`Администратор ${result.email} ${action}.`);
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
