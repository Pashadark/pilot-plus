import { prisma } from '../../src/database/prisma/client';

export const E2E_MAINTENANCE_TITLE_PREFIX = `[Pilot+ E2E maintenance:${process.pid}] `;

export async function cleanupE2EMaintenanceRecords() {
  const email = process.env.PILOT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error('Для очистки E2E-записей ТО нужен PILOT_ADMIN_EMAIL.');
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error('Администратор для очистки E2E-записей ТО не найден.');
  }

  await prisma.maintenanceRecord.deleteMany({
    where: {
      title: { startsWith: E2E_MAINTENANCE_TITLE_PREFIX },
      vehicle: { company: { members: { some: { userId: user.id } } } },
    },
  });

  await prisma.$disconnect();
}
