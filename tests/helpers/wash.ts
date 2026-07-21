import { prisma } from '../../src/database/prisma/client';

export const E2E_WASH_PROVIDER_PREFIX = `[Pilot+ E2E wash:${process.pid}] `;

export async function cleanupE2EWashRecords() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('Для очистки E2E-записей мойки нужен PILOT_ADMIN_EMAIL.');
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error('Администратор для очистки E2E-записей мойки не найден.');
  }

  await prisma.washRecord.deleteMany({
    where: {
      provider: { startsWith: E2E_WASH_PROVIDER_PREFIX },
      vehicle: { company: { members: { some: { userId: user.id } } } },
    },
  });

  await prisma.$disconnect();
}
